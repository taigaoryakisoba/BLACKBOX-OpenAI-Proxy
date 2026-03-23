import {
  BLACKBOX_APP_ORIGIN,
  BLACKBOX_CHECK_SUBSCRIPTION_URL,
  BlackboxApiClient,
} from '../apiClient';

export interface CheckBlackboxSubscriptionParams {
  cookieHeader: string;
  email: string;
  signal?: AbortSignal;
}

export const checkBlackboxSubscription = async ({
  cookieHeader,
  email,
  signal,
}: CheckBlackboxSubscriptionParams): Promise<Response> =>
  BlackboxApiClient.requestApi({
    url: BLACKBOX_CHECK_SUBSCRIPTION_URL,
    method: 'POST',
    headers: {
      origin: BLACKBOX_APP_ORIGIN,
    },
    cookieHeader,
    body: JSON.stringify({ email }),
    signal,
  });
