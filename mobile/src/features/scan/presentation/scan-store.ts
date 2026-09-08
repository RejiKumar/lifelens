import type { NormalizedImage, ScanResponse } from '@/features/scan/domain/types';

export interface PendingScan {
  image: NormalizedImage;
  idempotencyKey: string;
  contentHash: string;
}

let pendingScan: PendingScan | null = null;
let lastResult: { hash: string; scanId: string; result: ScanResponse } | null = null;

export const scanStore = {
  setPending(image: NormalizedImage, contentHash: string, idempotencyKey: string): PendingScan {
    pendingScan = { image, idempotencyKey, contentHash };
    return pendingScan;
  },

  getPending(): PendingScan | null {
    return pendingScan;
  },

  clearPending(): void {
    pendingScan = null;
  },

  rememberResult(hash: string, scanId: string, result: ScanResponse): void {
    lastResult = { hash, scanId, result };
  },

  findByHash(contentHash: string): { scanId: string; result: ScanResponse } | null {
    if (lastResult && lastResult.hash === contentHash) {
      return { scanId: lastResult.scanId, result: lastResult.result };
    }
    return null;
  },

  reset(): void {
    pendingScan = null;
    lastResult = null;
  },
};