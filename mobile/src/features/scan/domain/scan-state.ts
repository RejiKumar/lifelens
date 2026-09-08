import type { LifeLensError } from './errors';
import type { NormalizedImage, QuotaInfo, ScanResponse } from './types';

export const SCAN_STAGES = [
  'idle',
  'capturing',
  'processing',
  'preview',
  'uploading',
  'analyzing',
  'success',
  'error',
] as const;
export type ScanStage = (typeof SCAN_STAGES)[number];

export interface ScanFlowState {
  stage: ScanStage;
  image: NormalizedImage | null;
  scanId: string | null;
  result: ScanResponse | null;
  error: LifeLensError | null;
  quota: QuotaInfo | null;
  startedAtMs: number | null;
}

export const initialScanFlowState: ScanFlowState = {
  stage: 'idle',
  image: null,
  scanId: null,
  result: null,
  error: null,
  quota: null,
  startedAtMs: null,
};

export type ScanFlowAction =
  | { type: 'capturing' }
  | { type: 'processing' }
  | { type: 'preview-ready'; image: NormalizedImage }
  | { type: 'uploading' }
  | { type: 'analyzing' }
  | { type: 'succeeded'; scanId: string; result: ScanResponse }
  | { type: 'failed'; error: LifeLensError }
  | { type: 'reset' };

export function scanFlowReducer(state: ScanFlowState, action: ScanFlowAction): ScanFlowState {
  switch (action.type) {
    case 'capturing':
      return { ...state, stage: 'capturing', error: null };
    case 'processing':
      return { ...state, stage: 'processing', error: null };
    case 'preview-ready':
      return { ...state, stage: 'preview', image: action.image, error: null };
    case 'uploading':
      return { ...state, stage: 'uploading', startedAtMs: Date.now(), error: null };
    case 'analyzing':
      return { ...state, stage: 'analyzing' };
    case 'succeeded':
      return {
        ...state,
        stage: 'success',
        scanId: action.scanId,
        result: action.result,
        quota: action.result.quota,
        error: null,
      };
    case 'failed':
      return { ...state, stage: 'error', error: action.error };
    case 'reset':
      return { ...initialScanFlowState };
    default:
      return state;
  }
}