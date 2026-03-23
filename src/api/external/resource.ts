export interface GetExternalResourceParams {
  url: string;
  signal?: AbortSignal;
}

export const getExternalResource = async ({
  url,
  signal,
}: GetExternalResourceParams): Promise<Response> =>
  fetch(url, { signal });
