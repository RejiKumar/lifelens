import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GlassCard } from '@/components/ui/glass-card';
import { SafetyBanner } from '@/components/ui/safety-banner';
import { RiskBadge } from '@/components/ui/risk-badge';
import { useScanFlow } from '@/features/scan/presentation/scan-context';
import type { ScanResponse } from '@/features/scan/domain/types';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { state, fetchResult } = useScanFlow();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [result, setResult] = useState<ScanResponse | null>(
    state.result?.id === id ? state.result : null,
  );
  const [loading, setLoading] = useState(!(state.result?.id === id));
  const announcedRef = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const res = await fetchResult(id);
    setResult(res);
    setLoading(false);
  }, [id, fetchResult]);

  useEffect(() => {
    if (!(state.result?.id === id) && result === null) {
      load();
    }
  }, [id, state.result, result, load]);

  const analysis = result?.analysis ?? null;
  const safety = result?.safety;

  useEffect(() => {
    if (analysis && !announcedRef.current) {
      announcedRef.current = true;
      AccessibilityInfo.announceForAccessibility(
        `Analysis complete. ${analysis.title}. Risk level ${analysis.risk_level}.`,
      );
    }
  }, [analysis]);

  return (
    <ThemedView style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable onPress={() => router.dismiss()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <ThemedText type="default" themeColor="textSecondary">
            ← Back
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
          </View>
        )}

        {!loading && !analysis && (
          <View style={styles.centered}>
            <ThemedText type="default" themeColor="textSecondary">
              This scan is no longer available.
            </ThemedText>
            <Pressable onPress={() => router.dismiss()} style={styles.retryButton} accessibilityRole="button" accessibilityLabel="Go back to home">
              <ThemedText type="default" style={{ color: '#ffffff' }}>
                Go back
              </ThemedText>
            </Pressable>
          </View>
        )}

        {!loading && analysis && safety && (
          <View style={styles.body}>
            <RiskBadge riskLevel={analysis.risk_level} />
            <View accessible accessibilityLabel={`${analysis.title}. ${analysis.category}.`}>
              <ThemedText type="title">{analysis.title}</ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.category}>
                {analysis.category}
              </ThemedText>
            </View>

            <SafetyBanner riskLevel={analysis.risk_level} isMedicine={safety.is_medical} />

            <GlassCard>
              <ThemedText type="subtitle" accessibilityRole="header">
                What it is
              </ThemedText>
              <ThemedText type="default">{analysis.summary}</ThemedText>
            </GlassCard>

            {analysis.observations.length > 0 && (
              <GlassCard>
                <ThemedText type="subtitle" accessibilityRole="header">
                  Key details
                </ThemedText>
                {analysis.observations.map((item, index) => (
                  <ThemedText key={index} type="small" style={styles.listItem}>
                    • {item}
                  </ThemedText>
                ))}
              </GlassCard>
            )}

            {analysis.actions.length > 0 && (
              <GlassCard>
                <ThemedText type="subtitle" accessibilityRole="header">
                  What to do next
                </ThemedText>
                {analysis.actions.map((item, index) => (
                  <ThemedText key={index} type="small" style={styles.listItem}>
                    • {item}
                  </ThemedText>
                ))}
              </GlassCard>
            )}

            {analysis.warnings.length > 0 && (
              <GlassCard>
                <ThemedText type="subtitle" accessibilityRole="header">
                  Warnings
                </ThemedText>
                {analysis.warnings.map((item, index) => (
                  <ThemedText key={index} type="small" style={styles.listItem}>
                    • {item}
                  </ThemedText>
                ))}
              </GlassCard>
            )}

            {analysis.when_to_seek_help && (
              <GlassCard>
                <ThemedText type="subtitle" accessibilityRole="header">
                  When to seek help
                </ThemedText>
                <ThemedText type="small">{analysis.when_to_seek_help}</ThemedText>
              </GlassCard>
            )}

            <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
              AI analysis is not a substitute for professional advice. Results provided for
              informational purposes only.
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  backButton: { padding: Spacing.two },
  content: { paddingHorizontal: Spacing.four, gap: Spacing.four },
  body: { gap: Spacing.four },
  category: { marginTop: -Spacing.two },
  sectionTitle: { marginBottom: Spacing.two },
  listItem: { marginBottom: Spacing.one },
  disclaimer: { textAlign: 'center', marginTop: Spacing.two },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.six, gap: Spacing.three },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
  },
});