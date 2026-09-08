import { uploadScan, API_URL } from '@/features/scan/data/scan-api';
import type { NormalizedImage } from '@/features/scan/domain/types';

const image: NormalizedImage = {
  uri: 'file:///a.jpg',
  name: 'a.jpg',
  type: 'image/jpeg',
  width: 800,
  height: 600,
  sizeBytes: 1000,
  source: 'camera',
};

const okResponse: {
  id: string;
  status: string;
  created_at: string;
  analysis: unknown;
  safety: unknown;
  quota: unknown;
} = {
  id: 'scan-1',
  status: 'completed',
  created_at: '2026-01-01T00:00:00Z',
  analysis: null,
  safety: {
    risk_level: 'LOW',
    is_medical: false,
    is_hazardous: false,
    is_electrical: false,
    is_structural: false,
    is_vehicle: false,
    is_chemical: false,
    is_gas: false,
  },
  quota: null,
};

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe('uploadScan', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('posts to the analyze endpoint and parses the response', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(okResponse, 200));

    const result = await uploadScan({
      image,
      idempotencyKey: 'key-1',
      source: 'camera',
      sessionId: 'sess-1',
      contentHash: 'abc',
    });

    expect(result.id).toBe('scan-1');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${API_URL}/scan/analyze`);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-guest-session']).toBe('sess-1');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('retries on transient 500 then succeeds', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'PROVIDER_ERROR' } }, 502))
      .mockResolvedValueOnce(jsonResponse(okResponse, 200));

    const result = await uploadScan({
      image,
      idempotencyKey: 'key-1',
      source: 'camera',
      sessionId: 'sess-1',
      contentHash: 'abc',
    });

    expect(result.id).toBe('scan-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws mapped error for 4xx without retrying', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ error: { code: 'VALIDATION_ERROR' } }, 400));

    await expect(
      uploadScan({ image, idempotencyKey: 'key-1', source: 'camera', sessionId: 's', contentHash: 'abc' }),
    ).rejects.toMatchObject({ category: 'invalid_input', retryable: false, status: 400 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects immediately on cancel via external abort', async () => {
    const controller = new AbortController();
    controller.abort();
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });

    await expect(
      uploadScan({
        image,
        idempotencyKey: 'key-1',
        source: 'camera',
        sessionId: 's',
        contentHash: 'abc',
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ category: 'canceled' });
  });
});
