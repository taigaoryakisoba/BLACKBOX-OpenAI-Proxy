import { getBlackboxNextScript } from '../api/blackbox/_next/script';
import { getBlackboxAuthSession } from '../api/blackbox/api/auth/session';
import { checkBlackboxSubscription } from '../api/blackbox/api/check-subscription';
import {
  getBlackboxHomePage,
  submitBlackboxLogin,
} from '../api/blackbox/index';
import {
  LOGIN_EAGER,
  LOGIN_EMAIL,
  LOGIN_PASSWORD,
  LOGIN_RETRY_COOLDOWN_MS,
  SESSION_TOKEN,
  SUBSCRIPTION_CUSTOMER_ID,
} from '../configs/env';
import logger from './logger';

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

interface HeadersWithGetSetCookie extends Headers {
  getSetCookie(): string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSessionUser = (value: unknown): value is SessionUser =>
  isRecord(value) &&
  (!('email' in value) ||
    typeof value.email === 'string' ||
    value.email === null);

const isSessionPayload = (value: unknown): value is SessionPayload =>
  isRecord(value) &&
  (!('user' in value) || value.user === null || isSessionUser(value.user));

const hasGetSetCookie = (
  headers: Headers
): headers is HeadersWithGetSetCookie =>
  typeof Reflect.get(headers, 'getSetCookie') === 'function';

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
  if (hasGetSetCookie(headers)) {
    const setCookies = headers.getSetCookie();
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

export const extractServerActionError = (
  responseText: string
): string | null => {
  const codeMatch = responseText.match(
    /"type":"error","resultCode":"([^"]+)"/
  );
  if (codeMatch) return codeMatch[1];

  const messageMatch = responseText.match(/"message":"([^"]+)"/);
  return messageMatch ? messageMatch[1] : null;
};

export const buildEnvSessionCookieHeader = (sessionToken: string): string =>
  `next-auth.session-token=${sessionToken}`;

class BlackboxAuthService {
  private static instance: BlackboxAuthService | null = null;

  private runtimeCookieJar = new CookieJar();
  private runtimeCustomerId = '';
  private runtimeSessionEmail = '';
  private pendingLogin: Promise<BlackboxAuthContext> | null = null;
  private lastFailureAt = 0;
  private cachedEnvCustomerId: string | null | undefined;

  private constructor() {}

  static getInstance(): BlackboxAuthService {
    if (!BlackboxAuthService.instance) {
      BlackboxAuthService.instance = new BlackboxAuthService();
    }

    return BlackboxAuthService.instance;
  }

  private hasRuntimeCredentials(): boolean {
    return LOGIN_EMAIL.trim().length > 0 && LOGIN_PASSWORD.trim().length > 0;
  }

  private clearRuntimeState() {
    this.runtimeCookieJar.clear();
    this.runtimeCustomerId = '';
    this.runtimeSessionEmail = '';
  }

  private async fetchWithCookieJar(
    request: (cookieHeader: string) => Promise<Response>,
    cookieJar: CookieJar
  ): Promise<Response> {
    const response = await request(cookieJar.toHeader());
    cookieJar.setFromResponse(response);
    return response;
  }

  private async parseSessionPayload(
    cookieHeader: string
  ): Promise<SessionPayload | null> {
    if (!cookieHeader) return null;

    const response = await getBlackboxAuthSession({ cookieHeader });
    if (!response.ok) return null;

    const payload = await response.json().catch(() => null);
    return isSessionPayload(payload) ? payload : null;
  }

  private async resolveCustomerIdWithCookie(
    cookieHeader: string
  ): Promise<{ customerId: string; email: string }> {
    const session = await this.parseSessionPayload(cookieHeader);
    const email = session?.user?.email?.trim() ?? '';

    if (!email) {
      return {
        customerId: '',
        email: '',
      };
    }

    const response = await checkBlackboxSubscription({
      cookieHeader,
      email,
    });

    if (!response.ok) {
      return {
        customerId: '',
        email,
      };
    }

    const payload = await response.json().catch(() => null);
    const customerId =
      isRecord(payload) && typeof payload.customerId === 'string'
        ? payload.customerId
        : '';

    return {
      customerId,
      email,
    };
  }

  private async discoverLoginActionId(cookieJar: CookieJar): Promise<string> {
    const homeResponse = await this.fetchWithCookieJar(
      (cookieHeader) => getBlackboxHomePage({ cookieHeader }),
      cookieJar
    );
    const html = await homeResponse.text();
    const scriptPaths = extractScriptPaths(html);

    for (const scriptPath of scriptPaths) {
      const response = await this.fetchWithCookieJar(
        (cookieHeader) =>
          getBlackboxNextScript({
            scriptPath,
            cookieHeader,
          }),
        cookieJar
      );

      const scriptContent = await response.text();
      const actionId = extractLoginActionIdFromScript(scriptContent);
      if (actionId) return actionId;
    }

    throw new Error('Blackbox login action could not be discovered');
  }

  private async performRuntimeLogin(): Promise<BlackboxAuthContext> {
    const cookieJar = new CookieJar();
    const actionId = await this.discoverLoginActionId(cookieJar);

    const loginResponse = await this.fetchWithCookieJar(
      (cookieHeader) =>
        submitBlackboxLogin({
          actionId,
          email: LOGIN_EMAIL.trim(),
          password: LOGIN_PASSWORD,
          formState: LOGIN_ACTION_FORM_STATE,
          cookieHeader,
        }),
      cookieJar
    );

    const loginText = await loginResponse.text();
    const cookieHeader = cookieJar.toHeader();
    const session = await this.parseSessionPayload(cookieHeader);

    if (!session?.user?.email) {
      const errorCode =
        extractServerActionError(loginText) ??
        `login_failed_status_${loginResponse.status}`;
      throw new Error(`Blackbox runtime login failed: ${errorCode}`);
    }

    const customer = await this.resolveCustomerIdWithCookie(cookieHeader);

    this.runtimeCookieJar = cookieJar;
    this.runtimeCustomerId = customer.customerId;
    this.runtimeSessionEmail = customer.email || session.user.email || '';
    this.lastFailureAt = 0;

    logger.info(
      `[BlackboxAuth] Runtime login succeeded for ${this.runtimeSessionEmail || 'unknown user'}`
    );

    return {
      cookieHeader,
      customerId: customer.customerId,
      source: 'runtime',
    };
  }

  private async getRuntimeAuthContext(
    forceRefresh = false
  ): Promise<BlackboxAuthContext> {
    if (!this.hasRuntimeCredentials()) {
      return {
        cookieHeader: '',
        customerId: '',
        source: 'none',
      };
    }

    if (forceRefresh) {
      this.clearRuntimeState();
    }

    const cachedCookieHeader = this.runtimeCookieJar.toHeader();
    if (cachedCookieHeader) {
      return {
        cookieHeader: cachedCookieHeader,
        customerId: this.runtimeCustomerId,
        source: 'runtime',
      };
    }

    if (
      !forceRefresh &&
      this.lastFailureAt > 0 &&
      Date.now() - this.lastFailureAt < LOGIN_RETRY_COOLDOWN_MS
    ) {
      return {
        cookieHeader: '',
        customerId: '',
        source: 'none',
      };
    }

    if (!this.pendingLogin) {
      this.pendingLogin = this.performRuntimeLogin()
        .catch((error: unknown): BlackboxAuthContext => {
          this.lastFailureAt = Date.now();
          const message =
            error instanceof Error ? error.message : 'Runtime login failed';
          logger.warn(`[BlackboxAuth] ${message}`);
          this.clearRuntimeState();
          return {
            cookieHeader: '',
            customerId: '',
            source: 'none',
          };
        })
        .finally(() => {
          this.pendingLogin = null;
        });
    }

    return this.pendingLogin;
  }

  private async getEnvAuthContext(): Promise<BlackboxAuthContext | null> {
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

    if (typeof this.cachedEnvCustomerId === 'undefined') {
      const resolved = await this.resolveCustomerIdWithCookie(
        buildEnvSessionCookieHeader(sessionToken)
      ).catch(() => ({
        customerId: '',
        email: '',
      }));
      this.cachedEnvCustomerId = resolved.customerId || null;
    }

    return {
      cookieHeader: buildEnvSessionCookieHeader(sessionToken),
      customerId: this.cachedEnvCustomerId ?? '',
      source: 'env',
    };
  }

  async getAuthContext(forceRefresh = false): Promise<BlackboxAuthContext> {
    const envAuth = await this.getEnvAuthContext();
    if (envAuth) return envAuth;

    const runtimeAuth = await this.getRuntimeAuthContext(forceRefresh);
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
  }

  invalidateRuntimeSession(reason?: string) {
    if (reason) {
      logger.warn(`[BlackboxAuth] Invalidating runtime session: ${reason}`);
    }

    this.clearRuntimeState();
  }

  async warmUp() {
    if (!LOGIN_EAGER && !SESSION_TOKEN.trim()) return;
    await this.getAuthContext();
  }
}

const blackboxAuthService = BlackboxAuthService.getInstance();

export default blackboxAuthService;

export const getBlackboxAuthContext = async (
  forceRefresh = false
): Promise<BlackboxAuthContext> =>
  blackboxAuthService.getAuthContext(forceRefresh);

export const invalidateRuntimeBlackboxAuth = (reason?: string) =>
  blackboxAuthService.invalidateRuntimeSession(reason);

export const warmBlackboxAuth = async () => {
  await blackboxAuthService.warmUp();
};
