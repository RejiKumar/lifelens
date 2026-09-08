import { scanFlowReducer, initialScanFlowState } from '@/features/scan/domain/scan-state';
import type { ScanResponse } from '@/features/scan/domain/types';

const sampleImage = {
  uri: 'file:///a.jpg',
  name: 'a.jpg',
  type: 'image/jpeg',
  width: 800,
  height: 600,
  sizeBytes: 1000,
  source: 'camera' as const,
};

const sampleResult: ScanResponse = {
  id: 'scan-1',
  status: 'completed',
  created_at: '2026-01-01T00:00:00Z',
  analysis: {
    title: 'A thing',
    category: 'object',
    summary: 'It is a thing.',
    confidence: 0.9,
    risk_level: 'LOW',
    observations: [],
    actions: [],
    warnings: [],
    when_to_seek_help: null,
    follow_up_suggestions: [],
  },
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

describe('scanFlowReducer', () => {
  it('starts in idle with no image', () => {
    expect(initialScanFlowState.stage).toBe('idle');
    expect(initialScanFlowState.image).toBeNull();
  });

  it('transitions capturing -> processing -> preview', () => {
    let state = scanFlowReducer(initialScanFlowState, { type: 'capturing' });
    expect(state.stage).toBe('capturing');
    state = scanFlowReducer(state, { type: 'processing' });
    expect(state.stage).toBe('processing');
    state = scanFlowReducer(state, { type: 'preview-ready', image: sampleImage });
    expect(state.stage).toBe('preview');
    expect(state.image).toEqual(sampleImage);
  });

  it('records startedAtMs on uploading', () => {
    const state = scanFlowReducer(initialScanFlowState, { type: 'uploading' });
    expect(state.stage).toBe('uploading');
    expect(state.startedAtMs).not.toBeNull();
  });

  it('succeeds and stores result and quota', () => {
    const state = scanFlowReducer(initialScanFlowState, {
      type: 'succeeded',
      scanId: sampleResult.id,
      result: sampleResult,
    });
    expect(state.stage).toBe('success');
    expect(state.scanId).toBe(sampleResult.id);
    expect(state.result).toEqual(sampleResult);
  });

  it('fails and stores error while preserving image', () => {
    let state = scanFlowReducer(initialScanFlowState, { type: 'preview-ready', image: sampleImage });
    state = scanFlowReducer(state, {
      type: 'failed',
      error: {
        category: 'network',
        code: 'NETWORK_ERROR',
        message: 'offline',
        details: null,
        retryable: true,
        status: null,
      },
    });
    expect(state.stage).toBe('error');
    expect(state.error?.code).toBe('NETWORK_ERROR');
    expect(state.image).toEqual(sampleImage);
  });

  it('resets to initial state', () => {
    let state = scanFlowReducer(initialScanFlowState, { type: 'succeeded', scanId: 'x', result: sampleResult });
    state = scanFlowReducer(state, { type: 'reset' });
    expect(state).toEqual(initialScanFlowState);
  });
});