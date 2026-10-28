import type { ReactNode } from 'react';
import { StyleSheet, type ViewProps } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { Radius, Spacing } from '@/constants/theme';

export interface GlassCardProps extends ViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'systemChromeMaterial';
  children: ReactNode;
}

export function GlassCard({ intensity = 35, tint = 'systemChromeMaterial', style, children, ...rest }: GlassCardProps) {
  return (
    <GlassSurface intensity={intensity} tint={tint} radius={Radius.featured} shaded style={[styles.card, style]} {...rest}>
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
  },
});