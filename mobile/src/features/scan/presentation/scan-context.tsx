import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useReducer, type ReactNode } from 'react';
import type { NormalizedImage, ScanResponse, ScanSource } from '@/features/scan/domain/types';
import { type LifeLensError, toLifeLensError, clientError } from '@/features/scan/domain/errors';
import { scanFlowReducer, initialScanFlowState, type ScanFlowState } from '@/features/scan/domain/scan-state';
import { normalizeImage, hashNormalizedImage } from '@/features/scan/data/image-normalizer';
import { uploadScan, fetchScanById, newIdempotencyKey } from '@/features/scan/data/scan-api';
import { getOrCreateGuestSessionId } from '@/features/scan/data/guest-session';
import { scanStore } from './scan-store';
import { analytics } from '@/features/scan/analytics';

export interface ScanContextValue {
  state: ScanFlowState;
  prepareImage(
    source: ScanSource,
    uri: string,
    meta?: { width?: number; height?: number; mimeType?: string; fileName?: string },
  ): Promise<NormalizedImage | null>;
  analyze(): Promise<ScanResponse | null>;
  retry(): Promise<ScanResponse | null>;
  cancel(): void;
  reset(): void;
  fetchResult(scanId: string): Promise<ScanResponse | null>;
}

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(scanFlowReducer, initialScanFlowState);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const prepareImage = useCallback(
    async (
      source: ScanSource,
      uri: string,
      meta?: { width?: number; height?: number; mimeType?: string; fileName?: string },
    ): Promise<NormalizedImage | null> => {
      dispatch({ type: 'processing' });
      try {
        const image = await normalizeImage({ uri, source, ...meta });
        analytics.normalizationComplete(image.width, image.height, image.sizeBytes);
        const contentHash = await hashNormalizedImage(image.uri);
        const idempotencyKey = newIdempotencyKey();
        scanStore.setPending(image, contentHash, idempotencyKey);
        dispatch({ type: 'preview-ready', image });
        return image;
      } catch (error) {
        dispatch({ type: 'failed', error: toLifeLensError(error) });
        return null;
      }
    },
    [],
  );

  const runAnalysis = useCallback(
    async (isRetry: boolean): Promise<ScanResponse | null> => {
      const pending = scanStore.getPending();
      if (!pending) {
        dispatch({
          type: 'failed',
          error: clientError('internal', 'NO_PENDING_IMAGE', 'No image is ready to analyze.'),
        });
        return null;
      }

      const cached = scanStore.findByHash(pending.contentHash);
      if (cached && isRetry) {
        dispatch({ type: 'succeeded', scanId: cached.scanId, result: cached.result });
        return cached.result;
      }

      dispatch({ type: 'uploading' });
      const sessionId = await getOrCreateGuestSessionId();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const startedAt = state.startedAtMs ?? Date.now();
        const result = await uploadScan({
          image: pending.image,
          idempotencyKey: pending.idempotencyKey,
          source: pending.image.source,
          sessionId,
          contentHash: pending.contentHash,
          signal: controller.signal,
        });
        analytics.analysisCompleted(
          result.id,
          result.analysis?.risk_level ?? 'LOW',
          Date.now() - startedAt,
        );
        scanStore.rememberResult(pending.contentHash, result.id, result);
        dispatch({ type: 'succeeded', scanId: result.id, result });
        scanStore.clearPending();
        return result;
      } catch (error) {
        const mapped = toLifeLensError(error);
        dispatch({ type: 'failed', error: mapped });
        analytics.analysisFailed(mapped.category);
        return null;
      } finally {
        abortRef.current = null;
      }
    },
    [state.startedAtMs],
  );

  const analyze = useCallback(() => runAnalysis(false), [runAnalysis]);
  const retry = useCallback(() => runAnalysis(true), [runAnalysis]);

  const reset = useCallback(() => {
    cancel();
    dispatch({ type: 'reset' });
    scanStore.reset();
  }, [cancel]);

  const fetchResult = useCallback(async (scanId: string): Promise<ScanResponse | null> => {
    try {
      const sessionId = await getOrCreateGuestSessionId();
      return await fetchScanById(scanId, sessionId);
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<ScanContextValue>(
    () => ({
      state,
      prepareImage,
      analyze,
      retry,
      cancel,
      reset,
      fetchResult,
    }),
    [state, prepareImage, analyze, retry, cancel, reset, fetchResult],
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScanFlow(): ScanContextValue {
  const context = useContext(ScanContext);
  if (!context) {
    throw new Error('useScanFlow must be used within a ScanProvider');
  }
  return context;
}