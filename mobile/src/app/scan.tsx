import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScanFlow } from '@/features/scan/presentation/scan-context';
import { useReducedMotion } from '@/features/scan/presentation/use-reduced-motion';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ScanScreen() {
  const { state, analyze, retry } = useScanFlow();
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  progress.value = withRepeat(withTiming(1, { duration: reducedMotion ? 1200 : 1600 }), -1);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  const isBusy = state.stage === 'uploading' || state.stage === 'analyzing' || state.stage === 'processing';

  useEffect(() => {
    if (state.stage === 'error') return;
    if (state.stage === 'success') return;
    if (state.stage === 'preview') return;
    if (state.stage === 'idle') {
      if (state.image) analyze();
    }
  }, [state.stage, state.image, analyze]);

  if (state.stage === 'success' && state.result) {
    return null;
  }

  const retrying = state.stage === 'error' && state.error?.retryable;

  return (
    <ThemedView style={[styles.root, { backgroundColor: theme.background }]}>
      <Animated.View style={[styles.indicatorTrack, { backgroundColor: theme.backgroundElement }]}>
        <Animated.View style={[styles.indicator, indicatorStyle]} />
      </Animated.View>

      <ThemedText type="title" style={styles.title} accessibilityLiveRegion="polite">
        {isBusy ? 'Analyzing…' : state.stage === 'error' ? 'Something went wrong' : '…'}
      </ThemedText>

      {isBusy && (
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
          Identifying what you are looking at.
        </ThemedText>
      )}

      {state.stage === 'error' && (
        <View style={styles.errorBox}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.message}>
            {state.error?.message}
          </ThemedText>
          {retrying && (
            <View style={styles.retryArea}>
              <Pressable
                onPress={retry}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Try analyzing the photo again">
                <ThemedText type="default" style={{ color: '#ffffff', fontWeight: '600' }}>
                  Try Again
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <View style={styles.progress}>
        {isBusy && (
          <ThemedText type="small" themeColor="textSecondary">
            Generating your results…
          </ThemedText>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  indicatorTrack: {
    width: 160,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.five,
  },
  indicator: { height: 6, borderRadius: 3, backgroundColor: '#3B82F6' },
  title: { textAlign: 'center', marginBottom: Spacing.two },
  subtitle: { textAlign: 'center', paddingHorizontal: Spacing.five },
  errorBox: { alignItems: 'center', maxWidth: 320, gap: Spacing.four },
  message: { textAlign: 'center' },
  retryArea: { alignItems: 'center' },
  primaryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 16,
    alignItems: 'center',
  },
  progress: { marginTop: Spacing.six },
  pressed: { opacity: 0.8 },
});