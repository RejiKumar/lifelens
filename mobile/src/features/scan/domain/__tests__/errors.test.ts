import {
  errorFromEnvelope,
  clientError,
  errorFromUnknown,
  isLifeLensError,
  toLifeLensError,
  hexFromArrayBuffer,
} from '@/features/scan/domain/errors';

describe('error mapping', () => {
  it('maps envelope codes to categories with status', () => {
    const err = errorFromEnvelope(400, {
      error: { code: 'VALIDATION_ERROR', message: 'bad image', details: { field: 'image' } },
    });
    expect(err.category).toBe('invalid_input');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('bad image');
    expect(err.details).toEqual({ field: 'image' });
    expect(err.retryable).toBe(false);
    expect(err.status).toBe(400);
  });

  it('is retryable for 5xx', () => {
    const err = errorFromEnvelope(502, { error: { code: 'PROVIDER_ERROR' } });
    expect(err.retryable).toBe(true);
  });

  it('maps quota and timeout codes', () => {
    expect(errorFromEnvelope(429, { error: { code: 'QUOTA_EXCEEDED' } }).category).toBe('quota_exceeded');
    expect(errorFromEnvelope(503, { error: { code: 'PROVIDER_TIMEOUT' } }).category).toBe('timeout');
  });

  it('falls back to unknown category', () => {
    const err = errorFromEnvelope(418, { error: { code: 'WEIRD' } });
    expect(err.category).toBe('unknown');
    expect(err.retryable).toBe(false);
  });

  it('uses a default message when the envelope is empty', () => {
    const err = errorFromEnvelope(500, null);
    expect(err.message.length).toBeGreaterThan(0);
  });

  it('creates client errors with retryable based on category', () => {
    expect(clientError('network', 'NETWORK_ERROR', 'x').retryable).toBe(true);
    expect(clientError('invalid_input', 'VALIDATION_ERROR', 'x').retryable).toBe(false);
  });

  it('treats AbortError as canceled', () => {
    const err = errorFromUnknown(new DOMException('Aborted', 'AbortError'));
    expect(err.category).toBe('canceled');
  });

  it('treats unknown errors as network', () => {
    const err = errorFromUnknown(new Error('boom'));
    expect(err.category).toBe('network');
  });

  it('isLifeLensError and toLifeLensError round trip', () => {
    const created = clientError('timeout', 'TIMEOUT_ERROR', 'slow');
    expect(isLifeLensError(created)).toBe(true);
    expect(toLifeLensError(created)).toBe(created);
  });

  it('converts hex from ArrayBuffer', () => {
    const buf = new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer;
    expect(hexFromArrayBuffer(buf)).toBe('deadbeef');
  });
});