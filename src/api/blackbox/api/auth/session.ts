import {
  BLACKBOX_APP_ORIGIN,
  BLACKBOX_AUTH_SESSION_URL,
  BlackboxApiClient,
} from '../../apiClient';

export interface GetBlackboxAuthSessionParams {
  cookieHeader: string;
  signal?: AbortSignal;
}

export const getBlackboxAuthSession = async ({
  cookieHeader,
  signal,
}: GetBlackboxAuthSessionParams): Promise<Response> =>
  BlackboxApiClient.requestPage({
    url: BLACKBOX_AUTH_SESSION_URL,
    headers: {
      origin: BLACKBOX_APP_ORIGIN,
    },
    cookieHeader,
    signal,
  });
