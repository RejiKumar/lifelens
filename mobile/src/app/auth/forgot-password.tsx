import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ThemedScreen } from '@/components/ui/themed-screen';
import { Typography } from '@/components/ui/typography';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sendPasswordResetEmail } from '@/features/auth/data/password-reset';
import { authFailureFromError } from '@/features/auth/domain/auth-errors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const onSubmit = useCallback(async () => {
    setFormError(null);
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    setEmailError(ok ? null : 'Enter a valid email address.');
    if (!ok) return;
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(email.trim());
      setSent(true);
    } catch (error) {
      const failure = authFailureFromError(error as never);
      setFormError(failure.message);
    } finally {
      setSubmitting(false);
    }
  }, [email]);

  return (
    <ThemedScreen aurora style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + Size.sm }]}>
        <Pressable
          onPress={close}
          style={({ pressed }) => [styles.backButton, { backgroundColor: theme.glassTint, borderColor: theme.hairline }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Typography variant="body" themeColor="textSecondary">
            ← Back
          </Typography>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
          <Typography variant="largeTitle">Reset your password</Typography>

          {sent ? (
            <View style={styles.confirm} accessibilityRole="alert">
              <Typography variant="body">
                Check your email for a reset link. You can close this screen and we'll take it from
                there.
              </Typography>
              <Button
                  onPress={close}
                  size="lg"
                  fullWidth
                  accessibilityLabel="Done"
                  accessibilityHint="Closes the password reset screen">
                  Done
                </Button>
            </View>
          ) : (
            <View style={styles.form}>
              <Typography variant="body" themeColor="textSecondary">
                Enter your email and we'll send you a link to choose a new password.
              </Typography>

              <View style={styles.field}>
                <Typography variant="caption" themeColor="textSecondary">Email</Typography>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholder="you@example.com"
                  placeholderTextColor={theme.textSecondary}
                  accessibilityLabel="Email"
                  style={[styles.input, { color: theme.text, borderColor: theme.hairline, backgroundColor: theme.surface }]}
                />
                {emailError && (
                  <Typography variant="caption" themeColor="textSecondary" accessibilityRole="alert">
                    {emailError}
                  </Typography>
                )}
              </View>

              {formError && (
                <View
                  style={[styles.errorBox, { backgroundColor: riskTint }]}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite">
                  <Typography variant="caption" themeColor="textSecondary">
                    {formError}
                  </Typography>
                </View>
              )}

              <Button
                onPress={onSubmit}
                disabled={submitting}
                size="lg"
                fullWidth
                accessibilityLabel="Send reset link"
                accessibilityHint="Emails you a link to reset your password">
                {submitting ? 'Sending…' : 'Send Reset Link'}
              </Button>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </ThemedScreen>
  );
}

const riskTint = '#DC262628';

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.four, paddingBottom: Size.sm },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Size.huge,
    paddingHorizontal: Size.lg,
    borderRadius: Radius.featured,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  content: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  form: { gap: Spacing.three },
  field: { gap: Size.xs },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.small,
    paddingHorizontal: Size.lg,
    paddingVertical: Size.lg,
    fontSize: 16,
    minHeight: Size.huge,
  },
  errorBox: {
    borderRadius: Radius.small,
    padding: Spacing.three,
  },
  confirm: { gap: Spacing.three },
  pressed: { opacity: 0.8 },
});