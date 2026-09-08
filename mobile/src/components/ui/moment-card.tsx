import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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
      style={[styles.card, styles.cardAccent]}>
      <View style={styles.overlay} />
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.eyebrow}>
        MOMENT
      </ThemedText>
      <ThemedText type="title" accessibilityRole="header" style={styles.headline}>
        {headline}
      </ThemedText>
      <View style={styles.divider} />
      <View style={styles.actionRow}>
        <View style={styles.actionDot} />
        <ThemedText type="default" style={styles.action}>
          {action}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    padding: Spacing.four,
    paddingVertical: Spacing.five,
    gap: Spacing.three,
  },
  cardAccent: {
    backgroundColor: '#3B82F626',
  },
  overlay: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#3B82F6AA',
  },
  eyebrow: {
    letterSpacing: 2,
  },
  headline: {
    lineHeight: 48,
  },
  divider: {
    height: 1,
    backgroundColor: '#3B82F655',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  action: {
    flex: 1,
  },
});
