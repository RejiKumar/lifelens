import type { AuthError } from '@supabase/supabase-js';

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_exists'
  | 'email_not_verified'
  | 'weak_password'
  | 'invalid_email'
  | 'rate_limited'
  | 'provider' // Supabase AuthError code (generic, e.g. OAuth failure)
  | 'network'
  | 'session_expired'
  | 'unknown';

export interface AuthFailure {
  code: AuthErrorCode;
  message: string;
  field?: 'email' | 'password' | 'name' | null;
}

const KNOWN_CODES: Record<string, AuthErrorCode> = {
  invalid_credentials: 'invalid_credentials',
  email_exists: 'email_exists',
  user_already_exists: 'email_exists',
  email_not_confirmed: 'email_not_verified',
  email_changed_too_fast: 'rate_limited',
  over_email_send_rate_limit: 'rate_limited',
  weak_password: 'weak_password',
  password_too_short: 'weak_password',
  network_error: 'network',
  refresh_token_not_found: 'session_expired',
  refresh_token_already_used: 'session_expired',
  invalid_refresh_token: 'session_expired',
  session_expired: 'session_expired',
  bad_json: 'unknown',
  unexpected_failure: 'unknown',
};

export function isWeakPasswordCode(code: string): boolean {
  return code === 'weak_password' || code === 'password_too_short';
}

export function isEmailTakenCode(code: string): boolean {
  return code === 'email_exists' || code === 'user_already_exists';
}

export function isRateLimitCode(code: string): boolean {
  return (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    code === 'signup_disabled'
  );
}

export function authFailureFromError(error: AuthError | null, context?: string): AuthFailure {
  if (!error) {
    return { code: 'unknown', message: context ?? 'An unexpected error occurred.' };
  }
  const code = KNOWN_CODES[error.code ?? ''] ?? 'unknown';
  let message = context ?? 'We could not complete that. Please try again.';
  switch (code) {
    case 'invalid_credentials':
      message = 'Incorrect email or password.';
      break;
    case 'email_exists':
      message = 'An account with that email already exists. Try signing in.';
      break;
    case 'email_not_verified':
      message = 'Please verify your email before completing that step.';
      break;
    case 'weak_password':
      message = 'Password must be at least 8 characters with upper, lower, and a number.';
      break;
    case 'rate_limited':
      message = 'Too many attempts. Please try again in a few minutes.';
      break;
    case 'network':
      message = 'Check your connection and try again.';
      break;
    case 'session_expired':
      message = 'Your session has expired. Please sign in again.';
      break;
    default:
      message = context ?? 'We could not complete that. Please try again.';
  }
  return { code, message };
}

export function authErrorFromUnknown(cause: unknown): AuthFailure {
  if (cause && typeof cause === 'object' && 'code' in cause && 'messages' in cause) {
    const c = cause as { code: string; messages?: string[] };
    if (isWeakPasswordCode(c.code)) {
      return { code: 'weak_password', message: 'Password is too weak.', field: 'password' };
    }
    return authFailureFromError({
      name: 'AuthApiError',
      message: c.messages?.join(' ') ?? 'Authentication failed.',
      code: c.code,
      status: 400,
    } as AuthError);
  }
  if (cause instanceof Error && cause.message === 'Network request failed') {
    return { code: 'network', message: 'Check your connection and try again.' };
  }
  return { code: 'unknown', message: 'We could not complete that. Please try again.' };
}