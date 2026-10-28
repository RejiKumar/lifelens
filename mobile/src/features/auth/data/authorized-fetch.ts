import { getBearerHeaders, refreshAccessTokenOrExpire } from './token-provider';

export interface AuthorizedFetchInit {
  signal?: AbortSignal;
}

async function fetchWithBearer(url: string, init: RequestInit): Promise<Response> {
  const authHeaders = await getBearerHeaders();
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(authHeaders)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return fetch(url, { ...init, headers });
}

export async function authorizedFetch(
  url: string,
  init: RequestInit,
  _options: AuthorizedFetchInit = {},
): Promise<Response> {
  const first = await fetchWithBearer(url, init);
  if (first.status !== 401) return first;
  const refreshed = await refreshAccessTokenOrExpire();
  if (refreshed) {
    return fetchWithBearer(url, init);
  }
  return first;
}