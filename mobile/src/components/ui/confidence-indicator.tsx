import { StyleSheet, View } from 'react-native';

import { Typography } from '@/components/ui/typography';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ConfidenceIndicatorProps {
  confidence: number;
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High confidence';
  if (confidence >= 0.5) return 'Moderate confidence';
  return 'Low confidence';
}

export function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, confidence));
  const percent = Math.round(clamped * 100);
  const label = confidenceLabel(clamped);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Confidence: ${percent} percent, ${label.toLowerCase()}`}
      style={[
        styles.card,
        { backgroundColor: theme.background, borderColor: theme.hairline },
      ]}>
      <View style={styles.row}>
        <Typography variant="caption" themeColor="textSecondary">
          Confidence
        </Typography>
        <Typography variant="caption" themeColor="textSecondary">
          {percent}% · {label}
        </Typography>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${percent}%`,
              backgroundColor: label === 'Low confidence' ? '#D97706' : theme.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.standard,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Size.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Size.sm,
  },
  track: {
    height: Size.sm,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});