export type ErrorCategory =
  | 'invalid_input'
  | 'payload_too_large'
  | 'quota_exceeded'
  | 'analysis_failed'
  | 'not_found'
  | 'unauthorized'
  | 'expired_session'
  | 'unavailable'
  | 'timeout'
  | 'network'
  | 'canceled'
  | 'unsupported_format'
  | 'internal'
  | 'unknown';

export interface LifeLensError {
  category: ErrorCategory;
  code: string;
  message: string;
  details: Record<string, unknown> | null;
  retryable: boolean;
  status: number | null;
}

const API_CODE_CATEGORY: Record<string, ErrorCategory> = {
  VALIDATION_ERROR: 'invalid_input',
  PAYLOAD_SIZE_EXCEEDED: 'payload_too_large',
  QUOTA_EXCEEDED: 'quota_exceeded',
  ANALYSIS_FAILED: 'analysis_failed',
  MEDIA_TYPE_UNSUPPORTED: 'unsupported_format',
  IMAGE_TOO_SMALL: 'invalid_input',
  NOT_FOUND: 'not_found',
  UNAUTHORIZED: 'unauthorized',
  EXPIRED_SESSION: 'expired_session',
  INTERNAL_ERROR: 'internal',
  PROVIDER_ERROR: 'analysis_failed',
  PROVIDER_TIMEOUT: 'timeout',
  PROVIDER_UNAVAILABLE: 'unavailable',
  RATE_LIMITED: 'unavailable',
  UNKNOWN_ERROR: 'unknown',
};

const CLIENT_CODE_CATEGORY: Record<string, ErrorCategory> = {
  NETWORK_ERROR: 'network',
  TIMEOUT_ERROR: 'timeout',
  REQUEST_CANCELED: 'canceled',
  UNSUPPORTED_FORMAT: 'unsupported_format',
  PAYLOAD_TOO_LARGE: 'payload_too_large',
  IMAGE_TOO_SMALL: 'invalid_input',
  NORMALIZATION_FAILED: 'internal',
  PUBLIC_API_URL_MISSING: 'internal',
};

function categoryForCode(code: string): ErrorCategory {
  return API_CODE_CATEGORY[code] ?? CLIENT_CODE_CATEGORY[code] ?? 'unknown';
}

export function retryableForCategory(category: ErrorCategory, status: number | null): boolean {
  if (status != null && status >= 500) return true;
  if (status != null && status < 500) return false;
  switch (category) {
    case 'network':
    case 'timeout':
    case 'unavailable':
    case 'internal':
    case 'analysis_failed':
      return true;
    default:
      return false;
  }
}

export function errorFromEnvelope(status: number, payload: unknown): LifeLensError {
  const body = (payload ?? {}) as { error?: { code?: unknown; message?: unknown; details?: unknown } };
  const envelope = body.error ?? {};
  const code = typeof envelope.code === 'string' ? envelope.code : 'UNKNOWN_ERROR';
  const category = categoryForCode(code);
  return {
    category,
    code,
    message:
      typeof envelope.message === 'string' && envelope.message.length > 0
        ? envelope.message
        : 'Something went wrong while analyzing this image.',
    details:
      envelope.details != null && typeof envelope.details === 'object'
        ? (envelope.details as Record<string, unknown>)
        : null,
    retryable: retryableForCategory(category, status),
    status,
  };
}

export function clientError(
  category: ErrorCategory,
  code: string,
  message: string,
  details: Record<string, unknown> | null = null,
): LifeLensError {
  return {
    category,
    code,
    message,
    details,
    retryable: retryableForCategory(category, null),
    status: null,
  };
}

export function errorFromUnknown(cause: unknown): LifeLensError {
  if (isAbortError(cause)) {
    return clientError('canceled', 'REQUEST_CANCELED', 'The request was canceled.');
  }
  return clientError(
    'network',
    'NETWORK_ERROR',
    'Could not reach the service. Check your connection and try again.',
  );
}

export function isAbortError(cause: unknown): boolean {
  if (cause == null || typeof cause !== 'object') return false;
  const name = (cause as { name?: unknown }).name;
  return typeof name === 'string' && name === 'AbortError';
}

export function isLifeLensError(value: unknown): value is LifeLensError {
  return (
    value != null &&
    typeof value === 'object' &&
    'category' in value &&
    'code' in value &&
    'retryable' in value
  );
}

export function toLifeLensError(cause: unknown): LifeLensError {
  if (isLifeLensError(cause)) return cause;
  return errorFromUnknown(cause);
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexFromArrayBuffer(buffer: ArrayBuffer): string {
  return bytesToHex(new Uint8Array(buffer));
}