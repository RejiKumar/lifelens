import type { RiskLevel } from '@/features/scan/domain/types';
import { RISK_COLORS } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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
      style={[styles.banner, { backgroundColor: isHighRisk ? RISK_COLORS[riskLevel] : RISK_COLORS[riskLevel] + '22' }]}>
      <ThemedText type="smallBold" themeColor={isHighRisk ? 'text' : 'textSecondary'}>
        {riskLabel(riskLevel)}
      </ThemedText>
      {isMedicine && (
        <ThemedText type="small" themeColor="textSecondary">
          Not medical advice. Consult a healthcare professional.
        </ThemedText>
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
    borderRadius: 16,
    gap: Spacing.one,
  },
});