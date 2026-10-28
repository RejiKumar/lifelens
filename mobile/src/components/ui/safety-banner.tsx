import type { RiskLevel } from '@/features/scan/domain/types';
import { Radius, RISK_COLORS, Size, Spacing } from '@/constants/theme';
import { Typography } from '@/components/ui/typography';
import { StyleSheet, View } from 'react-native';

export interface SafetyBannerProps {
  riskLevel: RiskLevel;
  isMedicine: boolean;
}

export function SafetyBanner({ riskLevel, isMedicine }: SafetyBannerProps) {
  if (riskLevel === 'LOW') return null;

  const isHighRisk = riskLevel === 'HIGH' || riskLevel === 'CRITICAL';

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        {
          backgroundColor: isHighRisk ? RISK_COLORS[riskLevel] : RISK_COLORS[riskLevel] + '22',
          borderColor: RISK_COLORS[riskLevel] + (isHighRisk ? '' : '55'),
        },
      ]}>
      <Typography variant="subheadline" themeColor={isHighRisk ? 'text' : 'textSecondary'}>
        {riskLabel(riskLevel)}
      </Typography>
      {isMedicine && (
        <Typography variant="caption" themeColor="textSecondary">
          Not medical advice. Consult a healthcare professional.
        </Typography>
      )}
    </View>
  );
}

function riskLabel(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL':
      return 'CRITICAL RISK — Do not attempt yourself';
    case 'HIGH':
      return 'High risk — Use caution';
    case 'MEDIUM':
      return 'Moderate risk — Proceed carefully';
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  banner: {
    padding: Spacing.three,
    borderRadius: Radius.standard,
    gap: Size.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
});