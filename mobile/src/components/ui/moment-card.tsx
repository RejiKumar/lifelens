import { StyleSheet, View } from 'react-native';

import { Typography } from '@/components/ui/typography';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface MomentCardProps {
  headline: string;
  action: string;
}

export function MomentCard({ headline, action }: MomentCardProps) {
  const theme = useTheme();

  if (!headline.trim() || !action.trim()) return null;

  return (
    <View
      accessible
      accessibilityLabel={`Moment: ${headline}. ${action}.`}
      style={[
        styles.card,
        { borderColor: theme.hairline, backgroundColor: theme.glassTint, shadowColor: theme.shadow },
      ]}>
      <View style={[styles.orb, { backgroundColor: theme.accent }]} />
      <Typography variant="caption" themeColor="accent" style={styles.eyebrow}>
        MOMENT
      </Typography>
      <Typography variant="largeTitle" accessibilityRole="header" style={styles.headline}>
        {headline}
      </Typography>
      <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
      <View style={styles.actionRow}>
        <View style={[styles.actionDot, { backgroundColor: theme.accent }]} />
        <Typography variant="body" style={styles.action}>
          {action}
        </Typography>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Radius.featured,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    paddingVertical: Spacing.five,
    gap: Spacing.three,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  orb: {
    position: 'absolute',
    top: -Size.xxl,
    right: -Size.xxl,
    width: Size.xxxl * 4,
    height: Size.xxxl * 4,
    borderRadius: Size.xxxl * 2,
    opacity: 0.16,
  },
  eyebrow: {
    letterSpacing: 2,
  },
  headline: {
    lineHeight: 38,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actionDot: {
    width: Size.sm,
    height: Size.sm,
    borderRadius: Size.xs,
  },
  action: {
    flex: 1,
  },
});