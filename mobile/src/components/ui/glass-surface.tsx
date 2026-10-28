import { BlurView, type BlurTint } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import type { ReactNode, RefObject } from 'react';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { useReducedMotion } from '@/features/scan/presentation/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

export interface GlassSurfaceProps extends ViewProps {
  children: ReactNode;
  intensity?: number;
  tint?: BlurTint;
  variant?: 'translucent' | 'opaque';
  blurTarget?: RefObject<View | null>;
  radius?: number;
  bordered?: boolean;
  shaded?: boolean;
}

function canUseLiquidGlass(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

export function GlassSurface({
  children,
  intensity = 40,
  tint = 'systemChromeMaterial',
  variant = 'translucent',
  blurTarget,
  radius = Radius.standard,
  bordered = true,
  shaded = false,
  style,
  ...rest
}: GlassSurfaceProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();

  const baseStyle: ViewStyle[] = [{ borderRadius: radius, overflow: 'hidden' }];
  if (bordered) {
    baseStyle.push({ borderWidth: StyleSheet.hairlineWidth, borderColor: theme.hairline });
  }
  if (shaded) {
    baseStyle.push({
      shadowColor: theme.shadow,
      shadowOpacity: 1,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 16 },
      elevation: 12,
    });
  }
  if (style) {
    baseStyle.push(style as ViewStyle);
  }

  if (variant === 'opaque') {
    return (
      <View {...rest} style={[{ backgroundColor: theme.surface }, ...baseStyle]}>
        {children}
      </View>
    );
  }

  if (Platform.OS === 'android') {
    const androidProps = blurTarget
      ? { blurMethod: 'dimezisBlurViewSdk31Plus' as const, blurTarget, blurReductionFactor: 4 }
      : {};
    return (
      <BlurView
        {...rest}
        {...androidProps}
        intensity={reduced ? 100 : Math.max(1, Math.round(intensity * 0.9))}
        tint={tint}
        style={[{ backgroundColor: theme.glassTint }, ...baseStyle]}>
        {children}
      </BlurView>
    );
  }

  if (Platform.OS === 'ios' && canUseLiquidGlass()) {
    return (
      <GlassView
        {...rest}
        tintColor={theme.glassTintStrong}
        glassEffectStyle={reduced ? 'none' : 'regular'}
        style={baseStyle}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView {...rest} intensity={reduced ? 100 : intensity} tint={tint} style={[{ backgroundColor: theme.glassTint }, ...baseStyle]}>
      {children}
    </BlurView>
  );
}