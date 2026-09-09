import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { File as ExpoFile } from 'expo-file-system';

import type {
  ChatHistoryResponse,
  FollowUpResponse,
  HistoryResponse,
  NormalizedImage,
  ScanResponse,
  ScanSource,
  SignedUrlResponse,
} from '../domain/types';
import { type LifeLensError, toLifeLensError, errorFromEnvelope, clientError } from '../domain/errors';

const DEFAULT_API_URL = 'http://localhost:8000';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') || DEFAULT_API_URL);

const REQUEST_TIMEOUT_MS = 120_000;
const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

export interface UploadInput {
  image: NormalizedImage;
  idempotencyKey: string;
  source: ScanSource;
  sessionId: string;
  signal?: AbortSignal;
  contentHash: string;
}

export async function uploadScan(input: UploadInput): Promise<ScanResponse> {
  return retryRequest(async (signal) => {
    const form = await buildFormData(input);
    const response = await fetch(`${API_URL}/scan/analyze`, {
      method: 'POST',
      headers: { 'x-guest-session': input.sessionId },
      body: form,
      signal,
    });
    const payload = await parsePayload(response);
    if (!response.ok) throw errorFromEnvelope(response.status, payload);
    return payload as ScanResponse;
  }, input.signal);
}

export async function fetchScanById(
  scanId: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<ScanResponse> {
  return retryRequest(async (reqSignal) => {
    const response = await fetch(`${API_URL}/scan/${encodeURIComponent(scanId)}`, {
      method: 'GET',
      headers: { 'x-guest-session': sessionId },
      signal: reqSignal,
    });
    const payload = await parsePayload(response);
    if (!response.ok) throw errorFromEnvelope(response.status, payload);
    return payload as ScanResponse;
  }, signal);
}

export async function fetchSignedUrlById(
  scanId: string,
  sessionId: string,
): Promise<SignedUrlResponse> {
  const response = await withTimeout((signal) =>
    fetch(`${API_URL}/scan/${encodeURIComponent(scanId)}/signed-url`, {
      method: 'GET',
      headers: { 'x-guest-session': sessionId },
      signal,
    }),
  );
  const payload = await parsePayload(response);
  if (!response.ok) throw errorFromEnvelope(response.status, payload);
  return payload as SignedUrlResponse;
}

export async function postFollowUp(
  analysisId: string,
  question: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<FollowUpResponse> {
  return retryRequest(async (reqSignal) => {
    const response = await fetch(
      `${API_URL}/analysis/${encodeURIComponent(analysisId)}/follow-up`,
      {
        method: 'POST',
        headers: { 'x-guest-session': sessionId, 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
        signal: reqSignal,
      },
    );
    const payload = await parsePayload(response);
    if (!response.ok) throw errorFromEnvelope(response.status, payload);
    return payload as FollowUpResponse;
  }, signal);
}

export interface ChatHistoryParams {
  limit?: number;
  cursor?: string | null;
}

export async function fetchChatHistory(
  analysisId: string,
  sessionId: string,
  params: ChatHistoryParams = {},
  signal?: AbortSignal,
): Promise<ChatHistoryResponse> {
  return retryRequest(async (reqSignal) => {
    const query = new URLSearchParams();
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    const queryString = query.toString();
    const url = `${API_URL}/analysis/${encodeURIComponent(analysisId)}/chat-history${
      queryString ? `?${queryString}` : ''
    }`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'x-guest-session': sessionId },
      signal: reqSignal,
    });
    const payload = await parsePayload(response);
    if (!response.ok) throw errorFromEnvelope(response.status, payload);
    return payload as ChatHistoryResponse;
  }, signal);
}

export interface HistoryParams {
  limit?: number;
  offset?: number;
}

export async function fetchScanHistory(
  sessionId: string,
  params: HistoryParams = {},
  signal?: AbortSignal,
): Promise<HistoryResponse> {
  return retryRequest(async (reqSignal) => {
    const query = new URLSearchParams();
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.offset != null) query.set('offset', String(params.offset));
    const queryString = query.toString();
    const url = `${API_URL}/scan/history${queryString ? `?${queryString}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'x-guest-session': sessionId },
      signal: reqSignal,
    });
    const payload = await parsePayload(response);
    if (!response.ok) throw errorFromEnvelope(response.status, payload);
    return payload as HistoryResponse;
  }, signal);
}

async function retryRequest<T>(
  task: (signal: AbortSignal) => Promise<T>,
  external?: AbortSignal,
): Promise<T> {
  let lastError: LifeLensError | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await withTimeout(task, external);
    } catch (error) {
      const mapped = toLifeLensError(error);
      lastError = mapped;
      if (mapped.category === 'canceled' || !mapped.retryable) throw mapped;
      if (attempt < RETRY_DELAYS_MS.length) {
        await delay(RETRY_DELAYS_MS[attempt]);
      }
    }
  }
  throw lastError!;
}

async function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  external?: AbortSignal,
): Promise<T> {
  if (external?.aborted) {
    throw clientError('canceled', 'REQUEST_CANCELED', 'The request was canceled.');
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  external?.addEventListener('abort', onExternalAbort);
  try {
    return await task(controller.signal);
  } catch (error) {
    if (timedOut) {
      throw clientError('timeout', 'TIMEOUT_ERROR', 'The request took too long. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onExternalAbort);
  }
}

async function parsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildFormData(input: UploadInput): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const response = await fetch(input.image.uri);
    const blob = await response.blob();
    const file = new File([blob], input.image.name, { type: input.image.type });
    form.append('image', file);
  } else {
    form.append('image', new ExpoFile(input.image.uri));
  }
  form.append('idempotency_key', input.idempotencyKey);
  form.append('source', input.source);
  return form;
}

export function newIdempotencyKey(): string {
  return Crypto.randomUUID();
}