import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { Typography } from '@/components/ui/typography';
import { PressableScale } from '@/components/ui/micro-motion';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: ViewStyle;
}

const sizeMap: Record<ButtonSize, { minHeight: number; paddingHorizontal: number; paddingVertical: number }> = {
  sm: { minHeight: Size.lg, paddingHorizontal: Spacing.three, paddingVertical: Size.xs },
  md: { minHeight: Size.huge, paddingHorizontal: Spacing.four, paddingVertical: Size.sm },
  lg: { minHeight: Size.huge + Size.sm, paddingHorizontal: Spacing.five, paddingVertical: Size.md },
};

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const sizeStyle = sizeMap[size];

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: theme.accent,
        };
      case 'secondary':
        return {
          backgroundColor: theme.glassTint,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.hairline,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        };
      case 'danger':
        return {
          backgroundColor: '#DC262628',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '#DC262640',
        };
    }
  };

  const getTextColor = (): 'accentText' | 'text' | 'textSecondary' => {
    switch (variant) {
      case 'primary':
        return 'accentText';
      case 'secondary':
        return 'textSecondary';
      case 'ghost':
        return 'text';
      case 'danger':
        return 'text';
    }
  };

  const spinnerColor = variant === 'primary' ? theme.accentText : theme.textSecondary;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.base,
        sizeStyle,
        fullWidth && styles.fullWidth,
        getVariantStyle(),
        (disabled || loading) && styles.disabled,
        style,
      ]}>
      {loading ? <ActivityIndicator size="small" color={spinnerColor} /> : (
        <Typography variant={size === 'sm' ? 'caption' : 'subheadline'} themeColor={getTextColor()}>
          {children}
        </Typography>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.5,
  },
});