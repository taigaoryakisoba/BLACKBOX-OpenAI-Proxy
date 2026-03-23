import {
  BASE_HEADERS,
  LOGIN_EAGER,
  LOGIN_EMAIL,
  LOGIN_PASSWORD,
  LOGIN_RETRY_COOLDOWN_MS,
  SESSION_TOKEN,
  SUBSCRIPTION_CUSTOMER_ID,
} from '../configs/env';
import logger from './logger';

const APP_ORIGIN = 'https://app.blackbox.ai';
const HOME_URL = `${APP_ORIGIN}/`;
const AUTH_SESSION_URL = `${APP_ORIGIN}/api/auth/session`;
const CHECK_SUBSCRIPTION_URL = `${APP_ORIGIN}/api/check-subscription`;
const LOGIN_ACTION_FORM_STATE = '["$undefined","$K1"]';
const LOGIN_DISCOVERY_MARKERS = [
  'function LoginForm',
  'DefaultLoginButton',
  'useFormState',
  'name:"password"',
];

type AuthSource = 'env' | 'runtime' | 'none';

export interface BlackboxAuthContext {
  cookieHeader: string;
  customerId: string;
  source: AuthSource;
}

interface SessionUser {
  email?: string | null;
}

interface SessionPayload {
  user?: SessionUser | null;
}

class CookieJar {
  private readonly cookies = new Map<string, string>();

  clear() {
    this.cookies.clear();
  }

  setFromResponse(response: Response) {
    for (const setCookie of getSetCookieHeaders(response.headers)) {
      this.setFromSetCookie(setCookie);
    }
  }

  setFromSetCookie(setCookie: string) {
    const firstPart = setCookie.split(';', 1)[0] ?? '';
    const separatorIndex = firstPart.indexOf('=');
    if (separatorIndex <= 0) return;

    const name = firstPart.slice(0, separatorIndex).trim();
    const value = firstPart.slice(separatorIndex + 1).trim();

    if (!name) return;
    if (!value || value.toLowerCase() === 'deleted') {
      this.cookies.delete(name);
      return;
    }

    this.cookies.set(name, value);
  }

  toHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}

interface RuntimeAuthState {
  cookieJar: CookieJar;
  customerId: string;
  sessionEmail: string;
  pendingLogin: Promise<BlackboxAuthContext> | null;
  lastFailureAt: number;
}

const runtimeState: RuntimeAuthState = {
  cookieJar: new CookieJar(),
  customerId: '',
  sessionEmail: '',
  pendingLogin: null,
  lastFailureAt: 0,
};

let cachedEnvCustomerId: string | null | undefined;

const hasRuntimeCredentials = (): boolean =>
  LOGIN_EMAIL.trim().length > 0 && LOGIN_PASSWORD.trim().length > 0;

const buildBaseHeaders = (
  overrides: Record<string, string> = {}
): Record<string, string> => ({
  accept: BASE_HEADERS.accept,
  'accept-language': BASE_HEADERS['accept-language'],
  'cache-control': BASE_HEADERS['cache-control'],
  pragma: BASE_HEADERS.pragma,
  'user-agent': BASE_HEADERS['user-agent'],
  ...overrides,
});

const splitCombinedSetCookieHeader = (headerValue: string): string[] => {
  const cookies: string[] = [];
  let current = '';

  for (let index = 0; index < headerValue.length; index += 1) {
    const char = headerValue[index];
    if (
      char === ',' &&
      /^\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=/.test(headerValue.slice(index + 1))
    ) {
      if (current.trim()) cookies.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) cookies.push(current.trim());
  return cookies;
};

const getSetCookieHeaders = (headers: Headers): string[] => {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof withGetSetCookie.getSetCookie === 'function') {
    const setCookies = withGetSetCookie.getSetCookie();
    if (setCookies.length > 0) return setCookies;
  }

  const combined = headers.get('set-cookie');
  return combined ? splitCombinedSetCookieHeader(combined) : [];
};

const extractScriptPaths = (html: string): string[] =>
  Array.from(
    new Set(
      Array.from(html.matchAll(/src="([^"]+\.js)"/g))
        .map((match) => match[1])
        .filter((src) => src.startsWith('/_next/'))
    )
  );

export const extractLoginActionIdFromScript = (
  scriptContent: string
): string | null => {
  if (
    LOGIN_DISCOVERY_MARKERS.some((marker) => !scriptContent.includes(marker))
  ) {
    return null;
  }

  const loginIndex = scriptContent.indexOf('function LoginForm');
  if (loginIndex === -1) return null;

  const windowStart = Math.max(0, loginIndex - 4_000);
  const windowEnd = Math.min(scriptContent.length, loginIndex + 4_000);
  const windowText = scriptContent.slice(windowStart, windowEnd);

  const actionByVar = Array.from(
    windowText.matchAll(
      /var\s+([A-Za-z_$][\w$]*)=\(0,[A-Za-z_$][\w$]*\.\$\)\("([a-f0-9]{40})"\)/g
    )
  );

  const useFormStateMatch = windowText.match(
    /useFormState\)\(([A-Za-z_$][\w$]*),void 0\)/
  );

  if (useFormStateMatch) {
    const variableName = useFormStateMatch[1];
    const found = actionByVar.find((match) => match[1] === variableName);
    if (found) return found[2];
  }

  return actionByVar.at(-1)?.[2] ?? null;
};

export const extractServerActionError = (responseText: string): string | null => {
  const codeMatch = responseText.match(
    /"type":"error","resultCode":"([^"]+)"/
  );
  if (codeMatch) return codeMatch[1];

  const messageMatch = responseText.match(/"message":"([^"]+)"/);
  return messageMatch ? messageMatch[1] : null;
};

export const buildEnvSessionCookieHeader = (sessionToken: string): string =>
  `next-auth.session-token=${sessionToken}`;

const fetchWithCookieJar = async (
  url: string,
  init: RequestInit,
  cookieJar: CookieJar
): Promise<Response> => {
  const headers = new Headers(init.headers ?? {});
  const cookieHeader = cookieJar.toHeader();
  if (cookieHeader) headers.set('Cookie', cookieHeader);

  const response = await fetch(url, {
    ...init,
    headers,
  });
  cookieJar.setFromResponse(response);
  return response;
};

const parseSessionPayload = async (
  cookieHeader: string
): Promise<SessionPayload | null> => {
  if (!cookieHeader) return null;

  const response = await fetch(AUTH_SESSION_URL, {
    headers: buildBaseHeaders({
      Cookie: cookieHeader,
      origin: APP_ORIGIN,
    }),
  });

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  return payload && typeof payload === 'object' ? (payload as SessionPayload) : null;
};

const resolveCustomerIdWithCookie = async (
  cookieHeader: string
): Promise<{ customerId: string; email: string }> => {
  const session = await parseSessionPayload(cookieHeader);
  const email = session?.user?.email?.trim() ?? '';

  if (!email) {
    return {
      customerId: '',
      email: '',
    };
  }

  const response = await fetch(CHECK_SUBSCRIPTION_URL, {
    method: 'POST',
    headers: buildBaseHeaders({
      Cookie: cookieHeader,
      'Content-Type': 'application/json',
      origin: APP_ORIGIN,
    }),
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    return {
      customerId: '',
      email,
    };
  }

  const payload = await response.json().catch(() => null);
  const customerId =
    payload && typeof payload === 'object' && typeof payload.customerId === 'string'
      ? payload.customerId
      : '';

  return {
    customerId,
    email,
  };
};

const discoverLoginActionId = async (cookieJar: CookieJar): Promise<string> => {
  const homeResponse = await fetchWithCookieJar(
    HOME_URL,
    {
      headers: buildBaseHeaders({
        origin: APP_ORIGIN,
      }),
    },
    cookieJar
  );
  const html = await homeResponse.text();
  const scriptPaths = extractScriptPaths(html);

  for (const scriptPath of scriptPaths) {
    const response = await fetchWithCookieJar(
      new URL(scriptPath, APP_ORIGIN).toString(),
      {
        headers: buildBaseHeaders({
          origin: APP_ORIGIN,
          referer: HOME_URL,
        }),
      },
      cookieJar
    );

    const scriptContent = await response.text();
    const actionId = extractLoginActionIdFromScript(scriptContent);
    if (actionId) return actionId;
  }

  throw new Error('Blackbox login action could not be discovered');
};

const performRuntimeLogin = async (): Promise<BlackboxAuthContext> => {
  const cookieJar = new CookieJar();
  const actionId = await discoverLoginActionId(cookieJar);
  const formData = new FormData();
  formData.append('1_email', LOGIN_EMAIL.trim());
  formData.append('1_password', LOGIN_PASSWORD);
  formData.append('0', LOGIN_ACTION_FORM_STATE);

  const loginResponse = await fetchWithCookieJar(
    HOME_URL,
    {
      method: 'POST',
      headers: buildBaseHeaders({
        accept: 'text/x-component',
        origin: APP_ORIGIN,
        referer: HOME_URL,
        'Next-Action': actionId,
      }),
      body: formData,
    },
    cookieJar
  );

  const loginText = await loginResponse.text();
  const cookieHeader = cookieJar.toHeader();
  const session = await parseSessionPayload(cookieHeader);

  if (!session?.user?.email) {
    const errorCode =
      extractServerActionError(loginText) ?? `login_failed_status_${loginResponse.status}`;
    throw new Error(`Blackbox runtime login failed: ${errorCode}`);
  }

  const customer = await resolveCustomerIdWithCookie(cookieHeader);

  runtimeState.cookieJar = cookieJar;
  runtimeState.customerId = customer.customerId;
  runtimeState.sessionEmail = customer.email || session.user.email || '';
  runtimeState.lastFailureAt = 0;

  logger.info(
    `[BlackboxAuth] Runtime login succeeded for ${runtimeState.sessionEmail || 'unknown user'}`
  );

  return {
    cookieHeader,
    customerId: customer.customerId,
    source: 'runtime',
  };
};

const getRuntimeAuthContext = async (
  forceRefresh = false
): Promise<BlackboxAuthContext> => {
  if (!hasRuntimeCredentials()) {
    return {
      cookieHeader: '',
      customerId: '',
      source: 'none',
    };
  }

  if (forceRefresh) {
    runtimeState.cookieJar.clear();
    runtimeState.customerId = '';
    runtimeState.sessionEmail = '';
  }

  const cachedCookieHeader = runtimeState.cookieJar.toHeader();
  if (cachedCookieHeader) {
    return {
      cookieHeader: cachedCookieHeader,
      customerId: runtimeState.customerId,
      source: 'runtime',
    };
  }

  if (
    !forceRefresh &&
    runtimeState.lastFailureAt > 0 &&
    Date.now() - runtimeState.lastFailureAt < LOGIN_RETRY_COOLDOWN_MS
  ) {
    return {
      cookieHeader: '',
      customerId: '',
      source: 'none',
    };
  }

  if (!runtimeState.pendingLogin) {
    runtimeState.pendingLogin = performRuntimeLogin()
      .catch((error: any) => {
        runtimeState.lastFailureAt = Date.now();
        logger.warn(`[BlackboxAuth] ${error?.message ?? 'Runtime login failed'}`);
        runtimeState.cookieJar.clear();
        runtimeState.customerId = '';
        runtimeState.sessionEmail = '';
        return {
          cookieHeader: '',
          customerId: '',
          source: 'none' as const,
        };
      })
      .finally(() => {
        runtimeState.pendingLogin = null;
      });
  }

  return runtimeState.pendingLogin;
};

export const invalidateRuntimeBlackboxAuth = (reason?: string) => {
  if (reason) {
    logger.warn(`[BlackboxAuth] Invalidating runtime session: ${reason}`);
  }

  runtimeState.cookieJar.clear();
  runtimeState.customerId = '';
  runtimeState.sessionEmail = '';
};

const getEnvAuthContext = async (): Promise<BlackboxAuthContext | null> => {
  const sessionToken = SESSION_TOKEN.trim();
  if (!sessionToken) return null;

  const customerId = SUBSCRIPTION_CUSTOMER_ID.trim();
  if (customerId) {
    return {
      cookieHeader: buildEnvSessionCookieHeader(sessionToken),
      customerId,
      source: 'env',
    };
  }

  if (typeof cachedEnvCustomerId === 'undefined') {
    const resolved = await resolveCustomerIdWithCookie(
      buildEnvSessionCookieHeader(sessionToken)
    ).catch(() => ({
      customerId: '',
      email: '',
    }));
    cachedEnvCustomerId = resolved.customerId || null;
  }

  return {
    cookieHeader: buildEnvSessionCookieHeader(sessionToken),
    customerId: cachedEnvCustomerId ?? '',
    source: 'env',
  };
};

export const getBlackboxAuthContext = async (
  forceRefresh = false
): Promise<BlackboxAuthContext> => {
  const envAuth = await getEnvAuthContext();
  if (envAuth) return envAuth;

  const runtimeAuth = await getRuntimeAuthContext(forceRefresh);
  const staticCustomerId = SUBSCRIPTION_CUSTOMER_ID.trim();

  return {
    cookieHeader: runtimeAuth.cookieHeader,
    customerId: staticCustomerId || runtimeAuth.customerId,
    source:
      runtimeAuth.source === 'runtime'
        ? 'runtime'
        : staticCustomerId
          ? 'env'
          : 'none',
  };
};

export const warmBlackboxAuth = async () => {
  if (!LOGIN_EAGER && !SESSION_TOKEN.trim()) return;
  await getBlackboxAuthContext();
};
