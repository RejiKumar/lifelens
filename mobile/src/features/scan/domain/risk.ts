import type { RiskLevel } from './types';

export const RISK_BADGE_TIERS = ['success', 'info', 'warning', 'error'] as const;
export type RiskBadgeTier = (typeof RISK_BADGE_TIERS)[number];

export const RISK_BADGE_MAP: Record<RiskLevel, RiskBadgeTier> = {
  LOW: 'success',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'error',
};

export function riskBadgeTier(riskLevel: RiskLevel): RiskBadgeTier {
  return RISK_BADGE_MAP[riskLevel];
}