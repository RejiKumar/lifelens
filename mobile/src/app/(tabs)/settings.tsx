import { useColorScheme } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GlassCard } from '@/components/ui/glass-card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const scheme = useColorScheme();
  const themeLabel = scheme === 'dark' ? 'Dark' : 'Light';

  return (
    <ThemedView style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <ThemedText type="title">Settings</ThemedText>
      </View>

      <View style={styles.content}>
        <GlassCard>
          <ThemedText type="subtitle" accessibilityRole="header">
            Appearance
          </ThemedText>
          <View style={styles.row}>
            <ThemedText type="default">Theme</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              {themeLabel} (System)
            </ThemedText>
          </View>
        </GlassCard>

        <GlassCard>
          <ThemedText type="subtitle" accessibilityRole="header">
            About
          </ThemedText>
          <View style={styles.row}>
            <ThemedText type="default">Version</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              1.0.0 (MVP)
            </ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText type="default">AI Provider</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              Gemini
            </ThemedText>
          </View>
        </GlassCard>

        <GlassCard>
          <ThemedText type="subtitle" accessibilityRole="header">
            Disclaimer
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            AI analysis is not a substitute for professional advice. Results are
            provided for informational purposes only. Always consult a qualified
            professional for safety-critical decisions.
          </ThemedText>
        </GlassCard>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
