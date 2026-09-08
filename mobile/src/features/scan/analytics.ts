import type { ErrorCategory } from './domain/errors';
import type { RiskLevel, ScanSource } from './domain/types';

export type ScanLaunchMode = ScanSource | 'deeplink' | 'history';

export interface Analytics {
  scanStart(mode: ScanLaunchMode): void;
  cameraOpened(): void;
  cameraPermissionDenied(): void;
  photoCaptured(): void;
  photoPicked(): void;
  normalizationComplete(width: number, height: number, sizeBytes: number): void;
  uploadStarted(): void;
  analysisStarted(): void;
  analysisCompleted(scanId: string, riskLevel: RiskLevel, durationMs: number): void;
  analysisFailed(category: ErrorCategory): void;
  quotaWarning(remaining: number): void;
}

export const analytics: Analytics = {
  scanStart: () => {},
  cameraOpened: () => {},
  cameraPermissionDenied: () => {},
  photoCaptured: () => {},
  photoPicked: () => {},
  normalizationComplete: () => {},
  uploadStarted: () => {},
  analysisStarted: () => {},
  analysisCompleted: () => {},
  analysisFailed: () => {},
  quotaWarning: () => {},
};