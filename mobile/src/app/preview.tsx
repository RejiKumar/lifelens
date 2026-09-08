import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScanFlow } from '@/features/scan/presentation/scan-context';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function PreviewScreen() {
  const router = useRouter();
  const { state, analyze, reset } = useScanFlow();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const image = state.image;
  if (!image) {
    return (
      <ThemedView style={[styles.root, { backgroundColor: theme.background }]}>
        <ThemedText type="default" themeColor="textSecondary">
          No image selected.
        </ThemedText>
        <Pressable onPress={() => { reset(); router.dismissTo('/'); }}>
          <ThemedText type="linkPrimary">Go back</ThemedText>
        </Pressable>
      </ThemedView>
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

  return (
    <ThemedView style={[styles.root, { backgroundColor: theme.background }]}>
      <Image source={{ uri: image.uri }} contentFit="contain" style={styles.image} />

      <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing.four }]}>
        <Pressable onPress={onRetake} style={styles.retakeButton} accessibilityRole="button" accessibilityLabel="Retake photo">
          <ThemedText type="default" themeColor="textSecondary">
            Retake
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={onAnalyze}
          disabled={state.stage === 'uploading' || state.stage === 'analyzing'}
          style={({ pressed }) => [styles.analyzeButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Analyze photo">
          {state.stage === 'uploading' || state.stage === 'analyzing' ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <ThemedText type="default" style={styles.analyzeText}>
              Analyze
            </ThemedText>
          )}
        </Pressable>
      </View>

      <View style={[styles.info, { paddingTop: insets.top + Spacing.three }]}>
        <ThemedText type="small" themeColor="textSecondary">
          {image.width} x {image.height} · {(image.sizeBytes / 1024).toFixed(0)} KB
        </ThemedText>
      </View>

      {state.stage === 'error' && state.error && (
        <View style={[styles.errorOverlay, { paddingBottom: insets.bottom + Spacing.five }]}>
          <ThemedText type="small" style={styles.errorText}>
            {state.error.message}
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  image: { flex: 1 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.five,
    paddingHorizontal: Spacing.five,
  },
  retakeButton: { padding: Spacing.three },
  analyzeButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 16,
    minWidth: 120,
    alignItems: 'center',
  },
  analyzeText: { color: '#ffffff', fontWeight: '600' },
  pressed: { opacity: 0.8 },
  info: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: '#00000066',
    paddingVertical: Spacing.one,
  },
  errorOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: '#000000AA',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  errorText: { color: '#FCA5A5', textAlign: 'center' },
});