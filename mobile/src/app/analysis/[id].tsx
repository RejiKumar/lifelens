import { Image } from 'expo-image';
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

import { ExpandableText } from '@/components/ui/expandable-text';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { SafetyBanner } from '@/components/ui/safety-banner';
import { ThemedScreen } from '@/components/ui/themed-screen';
import { Typography } from '@/components/ui/typography';
import { ConfidenceIndicator } from '@/components/ui/confidence-indicator';
import { EvidenceCard } from '@/components/ui/evidence-card';
import { HonestyCallout } from '@/components/ui/honesty-callout';
import { MomentCard } from '@/components/ui/moment-card';
import { RiskBadge } from '@/components/ui/risk-badge';
import { SignUpPrompt } from '@/features/auth/presentation/auth-prompts';
import { useAuth } from '@/features/auth/presentation/auth-context';
import { useScanFlow } from '@/features/scan/presentation/scan-context';
import { useConversation } from '@/features/scan/presentation/use-conversation';
import { AskLifeLensCard } from '@/features/scan/presentation/ask-lifelens';
import { ConversationThread } from '@/features/scan/presentation/conversation-thread';
import { FollowUpComposer } from '@/features/scan/presentation/follow-up-composer';
import type { ScanResponse } from '@/features/scan/domain/types';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { state, fetchResult } = useScanFlow();
  const { state: authState } = useAuth();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [result, setResult] = useState<ScanResponse | null>(
    state.result?.id === id ? state.result : null,
  );
  const [loading, setLoading] = useState(!(state.result?.id === id));
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
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
  const localImage = state.image;
  const lowConfidence = analysis != null && analysis.confidence < 0.5;
  const severe =
    analysis?.risk_level === 'HIGH' || analysis?.risk_level === 'CRITICAL';
  const evidence = analysis?.evidence ?? [];

  useEffect(() => {
    if (analysis && !announcedRef.current) {
      announcedRef.current = true;
      AccessibilityInfo.announceForAccessibility(
        `Analysis complete. ${analysis.moment.headline} ${analysis.title}. Risk level ${analysis.risk_level}.` +
          (lowConfidence ? ' Low confidence — please verify before acting.' : ''),
      );
    }
  }, [analysis, lowConfidence]);

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
      if (authState === 'guest') {
        setShowGuestPrompt(true);
        return;
      }
      void conversation.send(question);
    },
    [authState, conversation],
  );

  return (
    <ThemedScreen aurora>
      <View style={[styles.header, { paddingTop: insets.top + Size.sm }]}>
        <Pressable
          onPress={() => router.dismiss()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: theme.glassTint, borderColor: theme.hairline },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Typography variant="body" themeColor="textSecondary">
            ← Back
          </Typography>
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
            { paddingBottom: insets.bottom + Spacing.five },
          ]}>
          {loading && (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          )}

          {!loading && !analysis && (
            <View style={styles.centered}>
              <Typography variant="body" themeColor="textSecondary" align="center">
                This scan is no longer available.
              </Typography>
              <Button
                onPress={() => router.dismiss()}
                size="lg"
                accessibilityLabel="Go back to home"
                accessibilityHint="Leaves this scan result">
                Go back
              </Button>
            </View>
          )}

          {!loading && analysis && safety && (
            <View style={styles.body}>
              {localImage && (
                <View style={[styles.hero, { borderColor: theme.hairline }]}>
                  <Image
                    source={{ uri: localImage.uri }}
                    contentFit="cover"
                    style={[styles.heroImage, { backgroundColor: theme.surface }]}
                    accessibilityLabel="Analyzed image"
                    accessibilityIgnoresInvertColors
                  />
                  <View style={[styles.categoryChip, { backgroundColor: theme.overlay }]}>
                    <Typography variant="caption" themeColor="onCamera" align="center">
                      {analysis.category}
                    </Typography>
                  </View>
                </View>
              )}

              {lowConfidence && <HonestyCallout />}

              <MomentCard headline={analysis.moment.headline} action={analysis.moment.action} />
              <RiskBadge riskLevel={analysis.risk_level} />
              <ConfidenceIndicator confidence={analysis.confidence} />
              <View accessible accessibilityLabel={`${analysis.title}. ${analysis.category}.`} style={styles.heading}>
                <Typography variant="largeTitle">{analysis.title}</Typography>
                {!localImage && (
                  <Typography variant="caption" themeColor="textSecondary">
                    {analysis.category}
                  </Typography>
                )}
              </View>

              <SafetyBanner riskLevel={analysis.risk_level} isMedicine={safety.is_medical} />

              {severe && (
                <EvidenceCard
                  evidence={evidence}
                  heading="Why LifeLens flagged this"
                />
              )}

              <GlassCard>
                <Typography variant="title" accessibilityRole="header" style={styles.sectionHeader}>
                  What it is
                </Typography>
                <ExpandableText text={analysis.summary} numberOfLines={5} />
              </GlassCard>

              {!severe && <EvidenceCard evidence={evidence} />}

              {analysis.observations.length > 0 && (
                <GlassCard>
                  <Typography variant="title" accessibilityRole="header" style={styles.sectionHeader}>
                    Key details
                  </Typography>
                  {analysis.observations.map((item, index) => (
                    <ExpandableText key={`observation-${index}`} text={`• ${item}`} numberOfLines={3} variant="body" themeColor="textSecondary" style={styles.listItem} />
                  ))}
                </GlassCard>
              )}

              {analysis.actions.length > 0 && (
                <GlassCard>
                  <Typography variant="title" accessibilityRole="header" style={styles.sectionHeader}>
                    What to do next
                  </Typography>
                  {analysis.actions.map((item, index) => (
                    <ExpandableText key={`action-${index}`} text={`• ${item}`} numberOfLines={3} themeColor="textSecondary" style={styles.listItem} />
                  ))}
                </GlassCard>
              )}

              {analysis.warnings.length > 0 && (
                <GlassCard>
                  <Typography variant="title" accessibilityRole="header" style={styles.sectionHeader}>
                    Warnings
                  </Typography>
                  {analysis.warnings.map((item, index) => (
                    <ExpandableText key={`warning-${index}`} text={`• ${item}`} numberOfLines={3} themeColor="textSecondary" style={styles.listItem} />
                  ))}
                </GlassCard>
              )}

              {analysis.when_to_seek_help && (
                <GlassCard>
                  <Typography variant="title" accessibilityRole="header" style={styles.sectionHeader}>
                    When to seek help
                  </Typography>
                  <ExpandableText text={analysis.when_to_seek_help} numberOfLines={4} themeColor="textSecondary" />
                </GlassCard>
              )}

              {canAsk && showInitialLoading && (
                <View style={styles.centered}>
                  <ActivityIndicator size="small" color={theme.accent} />
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
                  style={[styles.inlineError, { backgroundColor: theme.overlay }]}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite">
                  <Typography variant="caption" themeColor="textSecondary" align="center">
                    {conversation.lastError.message}
                  </Typography>
                  {conversation.lastError.retryable && (
                    <Button
                      onPress={onRetry}
                      size="sm"
                      accessibilityLabel="Try again"
                      accessibilityHint="Retries the follow-up question">
                      Try again
                    </Button>
                  )}
                </View>
              )}

              <Typography variant="caption" themeColor="textSecondary" align="center" style={styles.disclaimer}>
                AI analysis is not a substitute for professional advice. Results provided for
                informational purposes only.
              </Typography>
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

      <SignUpPrompt
        visible={showGuestPrompt}
        title="Sign up to ask follow-up questions"
        message="Guests can view their scan result. Create a free account to ask follow-up questions and keep your history."
        onDismiss={() => setShowGuestPrompt(false)}
      />
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Size.sm,
    alignItems: 'flex-start',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Size.huge,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.featured,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.8 },
  content: { paddingHorizontal: Spacing.four, gap: Spacing.four, flexGrow: 1 },
  body: { gap: Spacing.four },
  hero: {
    borderRadius: Radius.featured,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroImage: {
    width: '100%',
    height: Size.xhuge * 5,
  },
  categoryChip: {
    position: 'absolute',
    left: Spacing.three,
    bottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Size.xs,
    borderRadius: Radius.small,
  },
  heading: { gap: Size.xs, marginTop: -Size.sm },
  sectionHeader: { marginBottom: Size.sm },
  listItem: { marginBottom: Size.xs },
  disclaimer: { marginTop: Size.sm },
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
    borderRadius: Radius.standard,
  },
});