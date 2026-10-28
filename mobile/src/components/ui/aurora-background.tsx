import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { AppState, StyleSheet, useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/features/scan/presentation/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

export interface AuroraBackgroundProps {
  style?: StyleProp<ViewStyle>;
}

const BLOB_SIZE = 480;

export function AuroraBackground({ style }: AuroraBackgroundProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(withTiming(1, { duration: 30000, easing: Easing.linear }), -1, true);
  }, [reduced, progress]);

  useEffect(() => {
    if (reduced) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        progress.value = withRepeat(withTiming(1, { duration: 30000, easing: Easing.linear }), -1, true);
      } else {
        progress.value = 0;
      }
    });
    return () => subscription.remove();
  }, [reduced, progress]);

  const driftTop = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * -36 }, { translateY: progress.value * -20 }],
  }));
  const driftMid = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 28 }, { translateY: progress.value * -16 }],
  }));
  const driftBottom = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * -24 }, { translateY: progress.value * 28 }],
  }));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root, style]}>
      <Animated.View style={[styles.blob, styles.blobTop, { opacity: isDark ? 0.4 : 0.3, borderRadius: BLOB_SIZE / 2 }, driftTop]}>
        <LinearGradient colors={[theme.auroraTop, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[styles.blob, styles.blobMid, { opacity: isDark ? 0.35 : 0.25, borderRadius: 400 / 2 }, driftMid]}>
        <LinearGradient colors={[theme.auroraMid, 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[styles.blob, styles.blobBottom, { opacity: isDark ? 0.3 : 0.2, borderRadius: 360 / 2 }, driftBottom]}>
        <LinearGradient colors={[theme.auroraBottom, 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: BLOB_SIZE,
    height: BLOB_SIZE,
  },
  blobTop: {
    top: -120,
    left: -140,
  },
  blobMid: {
    bottom: -130,
    right: -140,
  },
  blobBottom: {
    top: '35%',
    left: '55%',
  },
});