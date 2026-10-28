import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ThemedScreen } from '@/components/ui/themed-screen';
import { Typography } from '@/components/ui/typography';
import { GuestLimitPrompt } from '@/features/auth/presentation/auth-prompts';
import { useAuth } from '@/features/auth/presentation/auth-context';
import { useScanFlow } from '@/features/scan/presentation/scan-context';
import { Size, Spacing, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function PreviewScreen() {
  const router = useRouter();
  const { state, analyze, reset } = useScanFlow();
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const limitReached =
    state.stage === 'error' &&
    state.error?.category === 'quota_exceeded' &&
    auth.state === 'guest';

  const image = state.image;
  if (!image) {
    return (
      <ThemedScreen aurora style={styles.root}>
        <View style={styles.centered}>
          <Typography variant="body" themeColor="textSecondary" align="center">
            No image selected.
          </Typography>
          <Pressable onPress={() => { reset(); router.dismissTo('/'); }} accessibilityRole="button" accessibilityLabel="Go back" style={styles.link}>
            <Typography variant="body" themeColor="accent">
              Go back
            </Typography>
          </Pressable>
        </View>
      </ThemedScreen>
    );
  }

  const onAnalyze = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await analyze();
    if (result) {
      router.dismiss();
      router.push(`/analysis/${result.id}`);
    }
  };

  const onRetake = () => {
    router.dismiss();
  };

  const busy = state.stage === 'uploading' || state.stage === 'analyzing';

  return (
    <ThemedScreen aurora style={styles.root}>
      <Image source={{ uri: image.uri }} contentFit="contain" style={styles.image} />

      <View style={[styles.info, { paddingTop: insets.top + Size.sm }]}>
        <View style={[styles.infoChip, { backgroundColor: theme.glassTint, borderColor: theme.hairline }]}>
          <Typography variant="caption" themeColor="textSecondary" align="center">
            {image.width} x {image.height} · {(image.sizeBytes / 1024).toFixed(0)} KB
          </Typography>
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing.four }]}>
        <Button
          onPress={onRetake}
          variant="secondary"
          size="lg"
          style={styles.sideButton}
          accessibilityLabel="Retake photo"
          accessibilityHint="Goes back to the camera to take a new photo">
          Retake
        </Button>

        <Button
          onPress={onAnalyze}
          disabled={busy}
          loading={busy}
          size="lg"
          style={styles.sideButton}
          accessibilityLabel="Analyze photo">
          Analyze
        </Button>
      </View>

      {state.stage === 'error' && state.error && (
        <View style={[styles.errorOverlay, { paddingBottom: insets.bottom + Spacing.five, backgroundColor: theme.overlay }]}>
          <Typography variant="caption" align="center" themeColor="onCamera">
            {state.error.message}
          </Typography>
        </View>
      )}

      <GuestLimitPrompt
        visible={limitReached}
        onDismiss={() => {
          if (state.stage === 'error') {
            reset();
          }
        }}
      />
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  image: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  link: {
    minHeight: Size.xxxl,
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.five,
  },
  sideButton: { flex: 1 },
  info: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  infoChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Size.xs,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
});