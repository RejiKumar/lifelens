import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { ThemedScreen } from '@/components/ui/themed-screen';
import { Typography } from '@/components/ui/typography';
import { useAuth } from '@/features/auth/presentation/auth-context';
import { Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const scheme = useColorScheme();
  const themeLabel = scheme === 'dark' ? 'Dark' : 'Light';
  const { state, user, signOut } = useAuth();

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <ThemedScreen aurora>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Size.sm, paddingBottom: insets.bottom + Spacing.six },
        ]}
        showsVerticalScrollIndicator={false}>
        <Typography variant="largeTitle" style={styles.header}>
          Settings
        </Typography>

        {state === 'authenticated' && user ? (
          <GlassCard style={styles.card}>
            <Typography variant="title" accessibilityRole="header">
              Account
            </Typography>
            <View style={styles.row}>
              <Typography variant="body">Name</Typography>
              <Typography variant="body" themeColor="textSecondary" style={styles.rowValue}>
                {user.name ?? '—'}
              </Typography>
            </View>
            <View style={styles.row}>
              <Typography variant="body">Email</Typography>
              <Typography variant="body" themeColor="textSecondary" numberOfLines={1} style={styles.rowValue}>
                {user.email ?? '—'}
              </Typography>
            </View>
            {user.emailVerified ? null : (
              <Typography variant="caption" themeColor="textSecondary">
                Verify your email to unlock your full daily quota.
              </Typography>
            )}
            <Button
              onPress={confirmSignOut}
              variant="danger"
              fullWidth
              style={styles.cardButton}
              accessibilityLabel="Sign out"
              accessibilityHint="Signs you out of your LifeLens account">
              Sign Out
            </Button>
          </GlassCard>
        ) : (
          <GlassCard style={styles.card}>
            <Typography variant="title" accessibilityRole="header">
              Account
            </Typography>
            <Typography variant="caption" themeColor="textSecondary">
              You're browsing as a guest. Sign in to keep your scans and unlock a higher daily
              quota.
            </Typography>
            <Button
              onPress={() => router.push('/auth/sign-in')}
              fullWidth
              style={styles.cardButton}
              accessibilityLabel="Sign in"
              accessibilityHint="Signs in to keep your scans">
              Sign In
            </Button>
          </GlassCard>
        )}

        <GlassCard style={styles.card}>
          <Typography variant="title" accessibilityRole="header">
            Appearance
          </Typography>
          <View style={styles.row}>
            <Typography variant="body">Theme</Typography>
            <Typography variant="body" themeColor="textSecondary" style={styles.rowValue}>
              {themeLabel} (System)
            </Typography>
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Typography variant="title" accessibilityRole="header">
            About
          </Typography>
          <View style={styles.row}>
            <Typography variant="body">Version</Typography>
            <Typography variant="body" themeColor="textSecondary" style={styles.rowValue}>
              1.0.0 (MVP)
            </Typography>
          </View>
          <View style={styles.row}>
            <Typography variant="body">AI Provider</Typography>
            <Typography variant="body" themeColor="textSecondary" style={styles.rowValue}>
              Gemini
            </Typography>
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Typography variant="title" accessibilityRole="header">
            Disclaimer
          </Typography>
          <Typography variant="caption" themeColor="textSecondary">
            AI analysis is not a substitute for professional advice. Results are
            provided for informational purposes only. Always consult a qualified
            professional for safety-critical decisions.
          </Typography>
        </GlassCard>
      </ScrollView>
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: Size.sm },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.four,
    gap: Size.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Size.sm,
    gap: Spacing.three,
  },
  rowValue: {
    textAlign: 'right',
    flexShrink: 1,
  },
  cardButton: {
    marginTop: Size.sm,
  },
});