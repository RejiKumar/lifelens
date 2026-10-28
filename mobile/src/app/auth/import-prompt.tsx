import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ThemedScreen } from '@/components/ui/themed-screen';
import { Typography } from '@/components/ui/typography';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/presentation/auth-context';

export default function ImportPromptScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pendingImport, dismissImportPrompt } = useAuth();

  const finish = () => {
    dismissImportPrompt();
    router.replace('/');
  };

  if (!pendingImport) {
    return null;
  }

  const scanCount = pendingImport.scanCount;

  return (
    <ThemedScreen aurora>
      <View style={[styles.content, { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.five }]}>
        <Typography variant="largeTitle" accessibilityRole="header">
          Import your scans?
        </Typography>
        <Typography variant="body" themeColor="textSecondary">
          {scanCount != null && scanCount > 0
            ? `We found ${scanCount} scan${scanCount === 1 ? '' : 's'} from your guest session. Import them to your account so you can access them anywhere.`
            : 'We found scans from your guest session. Import them to your account so you can access them anywhere.'}
        </Typography>

        <View style={styles.actions}>
          <Button
            onPress={finish}
            size="lg"
            fullWidth
            accessibilityLabel="Import all scans"
            accessibilityHint="Moves your guest scans into your account">
            Import All
          </Button>
          <Button
            onPress={finish}
            size="lg"
            variant="secondary"
            fullWidth
            accessibilityLabel="Start fresh without importing"
            accessibilityHint="Keeps your guest scans on this device only">
            Start Fresh
          </Button>
        </View>

        <Typography variant="caption" themeColor="textSecondary" style={styles.note}>
          Your guest data stays on this device. You can always create a new scan anytime.
        </Typography>
      </View>
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.four,
  },
  actions: { gap: Spacing.three },
  note: { textAlign: 'center' },
});