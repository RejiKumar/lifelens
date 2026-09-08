export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const SCAN_SOURCES = ['camera', 'gallery', 'file'] as const;
export type ScanSource = (typeof SCAN_SOURCES)[number];

export interface SafetyMetadata {
  risk_level: RiskLevel;
  is_medical: boolean;
  is_hazardous: boolean;
  is_electrical: boolean;
  is_structural: boolean;
  is_vehicle: boolean;
  is_chemical: boolean;
  is_gas: boolean;
}

export interface Moment {
  headline: string;
  action: string;
}

export interface AnalysisResult {
  title: string;
  category: string;
  summary: string;
  confidence: number;
  risk_level: RiskLevel;
  observations: string[];
  actions: string[];
  warnings: string[];
  when_to_seek_help: string | null;
  follow_up_suggestions: string[];
  moment: Moment;
}

export interface QuotaInfo {
  remaining: number;
  limit: number;
  resets_at: string | null;
}

export interface ScanResponse {
  id: string;
  status: 'completed' | 'failed';
  created_at: string;
  analysis: AnalysisResult | null;
  safety: SafetyMetadata;
  quota: QuotaInfo | null;
}

export interface SignedUrlResponse {
  signed_url: string;
  expires_at: string;
}

export interface NormalizedImage {
  uri: string;
  name: string;
  type: string;
  width: number;
  height: number;
  sizeBytes: number;
  source: ScanSource;
}