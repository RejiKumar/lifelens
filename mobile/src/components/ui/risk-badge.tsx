import type { RiskLevel } from '@/features/scan/domain/types';
import { riskBadgeTier, type RiskBadgeTier } from '@/features/scan/domain/risk';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

export interface RiskBadgeProps {
  riskLevel: RiskLevel;
}

const BADGE_COLORS: Record<RiskBadgeTier, { bg: string; fg: string; label: string }> = {
  success: { bg: '#16A34A22', fg: '#16A34A', label: 'Low risk' },
  info: { bg: '#2563EB22', fg: '#2563EB', label: 'Moderate risk' },
  warning: { bg: '#EA580C22', fg: '#EA580C', label: 'High risk' },
  error: { bg: '#DC262622', fg: '#DC2626', label: 'Critical risk' },
};

export function RiskBadge({ riskLevel }: RiskBadgeProps) {
  const tier = riskBadgeTier(riskLevel);
  const colors = BADGE_COLORS[tier];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Risk level: ${colors.label}`}
      style={[styles.badge, { backgroundColor: colors.bg }]}>
      <View style={[styles.dot, { backgroundColor: colors.fg }]} />
      <ThemedText type="smallBold" style={[styles.label, { color: colors.fg }]}>
        {colors.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: '700' },
});