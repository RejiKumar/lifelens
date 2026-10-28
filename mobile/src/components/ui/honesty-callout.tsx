import { StyleSheet, View } from 'react-native';

import { Typography } from '@/components/ui/typography';
import { Radius, Size, Spacing } from '@/constants/theme';
import { RISK_COLORS } from '@/constants/theme';

export function HonestyCallout() {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={styles.callout}>
      <Typography variant="caption" style={{ color: RISK_COLORS.MEDIUM }}>
        Not fully certain
      </Typography>
      <Typography variant="caption" themeColor="textSecondary">
        I could not identify this with high confidence. Treat the identification and
        any advice as possibly inaccurate — verify before acting.
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  callout: {
    borderRadius: Radius.standard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${RISK_COLORS.MEDIUM}55`,
    backgroundColor: `${RISK_COLORS.MEDIUM}22`,
    padding: Spacing.four,
    gap: Size.sm,
  },
});