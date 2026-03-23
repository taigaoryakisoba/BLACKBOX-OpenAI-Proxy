import {
  BLACKBOX_APP_ORIGIN,
  BLACKBOX_HOME_URL,
  BlackboxApiClient,
} from './apiClient';

export interface GetBlackboxHomePageParams {
  cookieHeader?: string;
  signal?: AbortSignal;
}

export interface SubmitBlackboxLoginParams {
  actionId: string;
  email: string;
  password: string;
  formState: string;
  cookieHeader?: string;
  signal?: AbortSignal;
}

export const getBlackboxHomePage = async ({
  cookieHeader = '',
  signal,
}: GetBlackboxHomePageParams = {}): Promise<Response> =>
  BlackboxApiClient.requestPage({
    url: BLACKBOX_HOME_URL,
    headers: {
      origin: BLACKBOX_APP_ORIGIN,
    },
    cookieHeader,
    signal,
  });

export const submitBlackboxLogin = async ({
  actionId,
  email,
  password,
  formState,
  cookieHeader = '',
  signal,
}: SubmitBlackboxLoginParams): Promise<Response> => {
  const formData = new FormData();
  formData.append('1_email', email);
  formData.append('1_password', password);
  formData.append('0', formState);

  return BlackboxApiClient.requestPage({
    url: BLACKBOX_HOME_URL,
    method: 'POST',
    headers: {
      accept: 'text/x-component',
      origin: BLACKBOX_APP_ORIGIN,
      referer: BLACKBOX_HOME_URL,
      'Next-Action': actionId,
    },
    cookieHeader,
    body: formData,
    signal,
  });
};
