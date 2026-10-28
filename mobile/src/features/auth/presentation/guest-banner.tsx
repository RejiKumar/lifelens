import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Typography } from '@/components/ui/typography';
import { Size, Spacing } from '@/constants/theme';
import { useAuth } from './auth-context';
import { isGuestBannerDismissed, setGuestBannerDismissed } from '../data/ui-preferences';

export function GuestBanner() {
  const router = useRouter();
  const { state } = useAuth();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    void isGuestBannerDismissed().then((value) => {
      if (mounted) setDismissed(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    void setGuestBannerDismissed();
  }, []);

  if (state !== 'guest' || dismissed !== false) return null;

  return (
    <GlassCard style={styles.banner}>
      <View style={styles.textColumn}>
        <Typography variant="subheadline" accessibilityRole="header">
          You're browsing as a guest
        </Typography>
        <Typography variant="caption" themeColor="textSecondary">
          Sign up to keep your scans and unlock 20 scans a day.
        </Typography>
      </View>
      <Button
        onPress={() => router.push('/auth/sign-up')}
        size="sm"
        accessibilityLabel="Sign up"
        accessibilityHint="Creates an account to keep your scans">
        Sign Up
      </Button>
      <Pressable
        onPress={dismiss}
        style={styles.dismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss guest banner">
        <Typography variant="caption" themeColor="textSecondary">
          Dismiss
        </Typography>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  textColumn: {
    flex: 1,
    gap: Size.xs,
  },
  dismiss: {
    minHeight: Size.huge,
    justifyContent: 'center',
    paddingHorizontal: Size.xs,
  },
});