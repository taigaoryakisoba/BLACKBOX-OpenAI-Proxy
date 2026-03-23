import { API_ENDPOINT, BASE_HEADERS } from '../../configs/env';

export const BLACKBOX_APP_ORIGIN = 'https://app.blackbox.ai';
export const BLACKBOX_HOME_URL = `${BLACKBOX_APP_ORIGIN}/`;
export const BLACKBOX_AUTH_SESSION_URL = `${BLACKBOX_APP_ORIGIN}/api/auth/session`;
export const BLACKBOX_CHECK_SUBSCRIPTION_URL = `${BLACKBOX_APP_ORIGIN}/api/check-subscription`;
export const BLACKBOX_CHAT_URL = API_ENDPOINT;

const BLACKBOX_PAGE_HEADERS = Object.freeze({
  accept: BASE_HEADERS.accept,
  'accept-language': BASE_HEADERS['accept-language'],
  'cache-control': BASE_HEADERS['cache-control'],
  pragma: BASE_HEADERS.pragma,
  'user-agent': BASE_HEADERS['user-agent'],
});

const withCookieHeader = (
  headers: Record<string, string>,
  cookieHeader = ''
): Record<string, string> => ({
  ...headers,
  ...(cookieHeader ? { Cookie: cookieHeader } : {}),
});

const buildPageHeaders = (
  headers: Record<string, string> = {},
  cookieHeader = ''
): Record<string, string> =>
  withCookieHeader(
    {
      ...BLACKBOX_PAGE_HEADERS,
      ...headers,
    },
    cookieHeader
  );

const buildApiHeaders = (
  headers: Record<string, string> = {},
  cookieHeader = ''
): Record<string, string> =>
  withCookieHeader(
    {
      ...BASE_HEADERS,
      ...headers,
    },
    cookieHeader
  );

const resolveUrl = (path: string): string =>
  new URL(path, BLACKBOX_APP_ORIGIN).toString();

interface BlackboxRequestParams {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  cookieHeader?: string;
  body?: BodyInit | null;
  signal?: AbortSignal;
}

const requestPage = async ({
  url,
  method = 'GET',
  headers = {},
  cookieHeader = '',
  body,
  signal,
}: BlackboxRequestParams): Promise<Response> =>
  fetch(url, {
    method,
    headers: buildPageHeaders(headers, cookieHeader),
    body,
    signal,
  });

const requestApi = async ({
  url,
  method = 'GET',
  headers = {},
  cookieHeader = '',
  body,
  signal,
}: BlackboxRequestParams): Promise<Response> =>
  fetch(url, {
    method,
    headers: buildApiHeaders(headers, cookieHeader),
    body,
    signal,
  });

export const BlackboxApiClient = {
  buildPageHeaders,
  buildApiHeaders,
  resolveUrl,
  requestPage,
  requestApi,
} as const;
