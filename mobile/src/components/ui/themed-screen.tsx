import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AuroraBackground } from '@/components/ui/aurora-background';
import { useTheme } from '@/hooks/use-theme';

export interface ThemedScreenProps {
  children: ReactNode;
  aurora?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ThemedScreen({ children, aurora = false, style }: ThemedScreenProps) {
  const theme = useTheme();
  return (
    <View style={[{ backgroundColor: theme.background, overflow: 'hidden' }, styles.flex, style]}>
      {aurora ? <AuroraBackground /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});