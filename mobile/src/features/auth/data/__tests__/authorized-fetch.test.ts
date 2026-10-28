import { authorizedFetch } from '../authorized-fetch';

jest.mock('../token-provider', () => {
  return {
    getBearerHeaders: jest.fn(async () => ({ Authorization: 'Bearer tok-1' })),
    refreshAccessTokenOrExpire: jest.fn(async () => null),
  };
});

import { getBearerHeaders, refreshAccessTokenOrExpire } from '../token-provider';

const mockedHeaders = getBearerHeaders as jest.MockedFunction<typeof getBearerHeaders>;
const mockedRefresh = refreshAccessTokenOrExpire as jest.MockedFunction<
  typeof refreshAccessTokenOrExpire
>;

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe('authorizedFetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedHeaders.mockResolvedValue({ Authorization: 'Bearer tok-1' });
    mockedRefresh.mockResolvedValue(null);
  });

  it('attaches the bearer header on the first call', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, 200));

    const response = await authorizedFetch('https://api.example/x', { method: 'GET' });

    expect(response.status).toBe(200);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer tok-1');
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    mockedRefresh.mockResolvedValue('tok-2');
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED' } }, 401))
      .mockResolvedValueOnce(jsonResponse({}, 200));
    mockedHeaders
      .mockResolvedValueOnce({ Authorization: 'Bearer tok-1' })
      .mockResolvedValueOnce({ Authorization: 'Bearer tok-2' });

    const response = await authorizedFetch('https://api.example/x', { method: 'GET' });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
    const retried = (fetchMock.mock.calls[1][1] as RequestInit).headers as Headers;
    expect(retried.get('Authorization')).toBe('Bearer tok-2');
  });

  it('does not retry when the refresh fails and returns the original 401', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED' } }, 401));

    const response = await authorizedFetch('https://api.example/x', { method: 'GET' });

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('merges bearer headers without overwriting explicit caller headers', async () => {
    mockedHeaders.mockResolvedValue({ Authorization: 'Bearer tok-1', 'x-extra': 'yes' });
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, 200));

    await authorizedFetch('https://api.example/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer tok-1');
    expect(headers.get('x-extra')).toBe('yes');
    expect(headers.get('content-type')).toBe('application/json');
  });
});