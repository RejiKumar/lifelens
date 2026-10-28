import { Text, type TextProps, type TextStyle } from 'react-native';

import type { ThemeColor, TypeStepName } from '@/constants/theme';
import { Typography as TypeScale } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface TypographyProps extends TextProps {
  variant: TypeStepName;
  themeColor?: ThemeColor;
  align?: TextStyle['textAlign'];
}

export function Typography({ variant, themeColor, align, style, ...rest }: TypographyProps) {
  const theme = useTheme();
  const step = TypeScale[variant];

  return (
    <Text
      allowFontScaling
      style={[{ color: theme[themeColor ?? 'text'], textAlign: align }, step, style]}
      {...rest}
    />
  );
}