import {
  BLACKBOX_APP_ORIGIN,
  BLACKBOX_HOME_URL,
  BlackboxApiClient,
} from '../apiClient';

export interface GetBlackboxNextScriptParams {
  scriptPath: string;
  cookieHeader?: string;
  signal?: AbortSignal;
}

export const getBlackboxNextScript = async ({
  scriptPath,
  cookieHeader = '',
  signal,
}: GetBlackboxNextScriptParams): Promise<Response> =>
  BlackboxApiClient.requestPage({
    url: BlackboxApiClient.resolveUrl(scriptPath),
    headers: {
      origin: BLACKBOX_APP_ORIGIN,
      referer: BLACKBOX_HOME_URL,
    },
    cookieHeader,
    signal,
  });
