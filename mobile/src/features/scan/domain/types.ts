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
  id?: string | null;
  scan_id?: string | null;
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
  used: number;
  limit: number;
  remaining: number;
  is_pro: boolean;
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

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  created_at: string;
}

export interface FollowUpResponse {
  message: ChatMessage;
  remaining_capacity: number;
  quota: QuotaInfo;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  next_cursor: string | null;
  remaining_capacity: number;
  quota: QuotaInfo;
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

export interface HistoryItem {
  id: string;
  created_at: string;
  title: string;
  category: string;
  risk_level: RiskLevel;
  moment_headline: string;
  source: string | null;
}

export interface HistoryResponse {
  items: HistoryItem[];
  total: number;
  has_more: boolean;
}