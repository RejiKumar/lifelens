import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GlassCard } from '@/components/ui/glass-card';
import { SafetyBanner } from '@/components/ui/safety-banner';
import { RiskBadge } from '@/components/ui/risk-badge';
import { MomentCard } from '@/components/ui/moment-card';
import { useScanFlow } from '@/features/scan/presentation/scan-context';
import { useConversation } from '@/features/scan/presentation/use-conversation';
import { AskLifeLensCard } from '@/features/scan/presentation/ask-lifelens';
import { ConversationThread } from '@/features/scan/presentation/conversation-thread';
import { FollowUpComposer } from '@/features/scan/presentation/follow-up-composer';
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
  const analysisId = analysis?.id ?? null;
  const conversation = useConversation(analysisId);

  useEffect(() => {
    if (analysis && !announcedRef.current) {
      announcedRef.current = true;
      AccessibilityInfo.announceForAccessibility(
        `Analysis complete. ${analysis.moment.headline} ${analysis.title}. Risk level ${analysis.risk_level}.`,
      );
    }
  }, [analysis]);

  const canAsk = !loading && analysis != null && safety != null && analysisId != null;
  const showEntry =
    canAsk && conversation.status === 'ready' && conversation.messages.length === 0;
  const showInitialLoading =
    canAsk && conversation.status === 'loading' && conversation.messages.length === 0;

  const onRetry = useCallback(() => {
    void conversation.retry();
  }, [conversation]);

  const onAsk = useCallback(
    (question: string) => {
      void conversation.send(question);
    },
    [conversation],
  );

  return (
    <ThemedView style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          onPress={() => router.dismiss()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <ThemedText type="default" themeColor="textSecondary">
            ← Back
          </ThemedText>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + Spacing.six },
          ]}>
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
              <Pressable
                onPress={() => router.dismiss()}
                style={styles.retryButton}
                accessibilityRole="button"
                accessibilityLabel="Go back to home">
                <ThemedText type="default" style={{ color: '#ffffff' }}>
                  Go back
                </ThemedText>
              </Pressable>
            </View>
          )}

          {!loading && analysis && safety && (
            <View style={styles.body}>
              <MomentCard headline={analysis.moment.headline} action={analysis.moment.action} />
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

              {canAsk && showInitialLoading && (
                <View style={styles.centered}>
                  <ActivityIndicator size="small" />
                </View>
              )}

              {canAsk && showEntry && (
                <AskLifeLensCard
                  suggestions={analysis.follow_up_suggestions}
                  onAsk={onAsk}
                  disabled={conversation.status === 'sending'}
                />
              )}

              {canAsk && conversation.messages.length > 0 && (
                <ConversationThread messages={conversation.messages} />
              )}

              {canAsk && conversation.status === 'error' && conversation.lastError != null && (
                <View
                  style={styles.inlineError}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite">
                  <ThemedText type="small" themeColor="textSecondary">
                    {conversation.lastError.message}
                  </ThemedText>
                  {conversation.lastError.retryable && (
                    <Pressable
                      onPress={onRetry}
                      style={styles.retryButton}
                      accessibilityRole="button"
                      accessibilityLabel="Try again">
                      <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                        Try again
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              )}

              <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
                AI analysis is not a substitute for professional advice. Results provided for
                informational purposes only.
              </ThemedText>
            </View>
          )}
        </ScrollView>

        {canAsk && (
          <FollowUpComposer
            onSubmit={onAsk}
            sending={conversation.status === 'sending'}
            disabled={
              conversation.status === 'loading' ||
              (conversation.status === 'ready' && conversation.remainingCapacity <= 0)
            }
          />
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  backButton: { padding: Spacing.two, alignSelf: 'flex-start' },
  content: { paddingHorizontal: Spacing.four, gap: Spacing.four, flexGrow: 1 },
  body: { gap: Spacing.four },
  category: { marginTop: -Spacing.two },
  listItem: { marginBottom: Spacing.one },
  disclaimer: { textAlign: 'center', marginTop: Spacing.two },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.three,
  },
  inlineError: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 16,
    backgroundColor: '#DC262622',
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
  },
});