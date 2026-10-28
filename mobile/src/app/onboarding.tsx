import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ThemedScreen } from '@/components/ui/themed-screen';
import { Typography } from '@/components/ui/typography';
import { Spacing } from '@/constants/theme';
import { markOnboardingSeen } from '@/features/auth/data/ui-preferences';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const continueToApp = async () => {
    await markOnboardingSeen();
    router.replace('/');
  };

  return (
    <ThemedScreen aurora>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.five },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.center}>
          <Typography variant="largeTitle" align="center">
            Point. Understand. Act.
          </Typography>
          <Typography variant="body" themeColor="textSecondary" align="center">
            Point your camera at anything unfamiliar and LifeLens will explain what it is, what to
            watch out for, and what to do next.
          </Typography>
          <Typography variant="body" themeColor="textSecondary" align="center">
            You can try it right away as a guest — no account needed.
          </Typography>
        </View>

        <View style={styles.actions}>
          <Button
            onPress={continueToApp}
            size="lg"
            fullWidth
            accessibilityLabel="Get started"
            accessibilityHint="Opens LifeLens as a guest">
            Get Started
          </Button>
          <Button
            onPress={() => router.push('/auth/sign-up')}
            size="lg"
            variant="secondary"
            fullWidth
            accessibilityLabel="Create an account"
            accessibilityHint="Signs you up so your scans are saved">
            Create an account
          </Button>
        </View>
      </ScrollView>
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.five,
    justifyContent: 'center',
  },
  center: {
    gap: Spacing.four,
    alignItems: 'center',
  },
  actions: { gap: Spacing.three, marginTop: Spacing.three },
});