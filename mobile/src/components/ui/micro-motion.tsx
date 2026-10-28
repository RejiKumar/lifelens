import { useEffect, type ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';
import { useReducedMotion } from '@/features/scan/presentation/use-reduced-motion';

function useReducedMotionDisabled(): boolean {
  return useReducedMotion();
}

export interface MotionProps {
  children: ReactNode;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export function FadeIn({ children, duration = Motion.entry, style }: MotionProps) {
  const reduced = useReducedMotionDisabled();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: reduced ? 0 : duration, easing: Easing.out(Easing.cubic) });
  }, [opacity, duration, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

export function FadeInUp({ children, duration = Motion.entry, distance = 10, style }: MotionProps & { distance?: number }) {
  const reduced = useReducedMotionDisabled();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(distance);

  useEffect(() => {
    if (reduced) {
      opacity.value = withTiming(1, { duration: 0 });
      translateY.value = withTiming(0, { duration: 0 });
      return;
    }
    const timing = { duration, easing: Easing.out(Easing.cubic) };
    opacity.value = withTiming(1, timing);
    translateY.value = withTiming(0, timing);
  }, [opacity, translateY, duration, distance, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

export function Reveal({ children, duration = Motion.reveal, style }: MotionProps) {
  const reduced = useReducedMotionDisabled();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.985);

  useEffect(() => {
    if (reduced) {
      opacity.value = withTiming(1, { duration: 0 });
      scale.value = withTiming(1, { duration: 0 });
      return;
    }
    const timing = { duration, easing: Easing.out(Easing.cubic) };
    opacity.value = withTiming(1, timing);
    scale.value = withTiming(1, timing);
  }, [opacity, scale, duration, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends PressableProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function PressableScale({ children, style, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const reduced = useReducedMotionDisabled();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        if (!reduced) {
          scale.value = withTiming(0.96, { duration: 120 });
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reduced) {
          scale.value = withTiming(1, { duration: 120 });
        }
        onPressOut?.(event);
      }}
      style={[animatedStyle, style]}>
      {children}
    </AnimatedPressable>
  );
}