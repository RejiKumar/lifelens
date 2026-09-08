import { BlurView } from 'expo-blur';
import { StyleSheet, type ViewProps } from 'react-native';
import type { ReactNode } from 'react';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReducedMotion } from '@/features/scan/presentation/use-reduced-motion';

export interface GlassCardProps extends ViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'systemChromeMaterial';
  children: ReactNode;
}

export function GlassCard({
  intensity = 30,
  tint = 'systemChromeMaterial',
  style,
  children,
  ...rest
}: GlassCardProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();

  return (
    <BlurView
      intensity={reducedMotion ? 100 : intensity}
      tint={tint}
      style={[styles.card, style]}
      {...rest}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: Spacing.four,
  },
});