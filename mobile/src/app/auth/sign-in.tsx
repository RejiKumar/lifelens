import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { useAuth } from '@/features/auth/presentation/auth-context';
import type { AuthFailure } from '@/features/auth/domain/auth-errors';

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { signIn, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const validate = useCallback(() => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    setEmailError(emailOk ? null : 'Enter a valid email address.');
    setPasswordError(password ? null : 'Enter your password.');
    return emailOk && password.length > 0;
  }, [email, password]);

  const applyFailure = useCallback(
    (failure: AuthFailure) => {
      if (failure.code === 'invalid_credentials') {
        setPasswordError(failure.message);
      } else if (failure.code === 'invalid_email') {
        setEmailError(failure.message);
      } else {
        setFormError(failure.message);
      }
    },
    [],
  );

  const onSubmit = useCallback(async () => {
    setFormError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      close();
    } catch (error) {
      applyFailure(error as AuthFailure);
    } finally {
      setSubmitting(false);
    }
  }, [validate, signIn, email, password, close, applyFailure]);

  const onGoogle = useCallback(async () => {
    setFormError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      close();
    } catch {
      setFormError('Google sign-in could not be completed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }, [signInWithGoogle, close]);

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
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
          <Typography variant="largeTitle">Welcome back</Typography>
          <Typography variant="body" themeColor="textSecondary">
            Sign in to keep your scans and history.
          </Typography>

          <View style={styles.form}>
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

            <View style={styles.field}>
              <Typography variant="caption" themeColor="textSecondary">Password</Typography>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                placeholder="Your password"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Password"
                style={[styles.input, { color: theme.text, borderColor: theme.hairline, backgroundColor: theme.surface }]}
              />
              {passwordError && (
                <Typography variant="caption" themeColor="textSecondary" accessibilityRole="alert">
                  {passwordError}
                </Typography>
              )}
            </View>

            <Pressable
              onPress={() => router.push('/auth/forgot-password')}
              style={styles.link}
              accessibilityRole="button"
              accessibilityLabel="Forgot password">
              <Typography variant="body" themeColor="accent">Forgot password?</Typography>
            </Pressable>

            {formError && (
              <View style={[styles.errorBox, { backgroundColor: riskTint }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
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
              style={styles.fullWidth}
              accessibilityLabel="Sign in"
              accessibilityHint="Submits your credentials and opens LifeLens">
              {submitting ? 'Signing in…' : 'Sign In'}
            </Button>

            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
              <Typography variant="caption" themeColor="textSecondary">
                or
              </Typography>
              <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
            </View>

            <Button
              onPress={onGoogle}
              disabled={googleLoading}
              size="lg"
              variant="secondary"
              fullWidth
              style={styles.fullWidth}
              accessibilityLabel="Continue with Google"
              accessibilityHint="Opens Google sign-in">
              {googleLoading ? 'Opening Google…' : 'Continue with Google'}
            </Button>

            <View style={styles.switchRow}>
              <Typography variant="caption" themeColor="textSecondary">
                New here?
              </Typography>
              <Pressable
                onPress={() => router.replace('/auth/sign-up')}
                style={styles.link}
                accessibilityRole="button"
                accessibilityLabel="Create account">
                <Typography variant="body" themeColor="accent">Create account</Typography>
              </Pressable>
            </View>
          </View>
        </ScrollView>
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
  pressed: { opacity: 0.8 },
  content: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  form: { gap: Spacing.three, marginTop: Spacing.two },
  field: { gap: Size.xs },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.small,
    paddingHorizontal: Size.lg,
    paddingVertical: Size.lg,
    fontSize: 16,
    minHeight: Size.huge,
  },
  link: { alignSelf: 'flex-start', minHeight: Size.huge, justifyContent: 'center' },
  errorBox: {
    borderRadius: Radius.small,
    padding: Spacing.three,
  },
  fullWidth: { alignSelf: 'stretch' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Size.xs,
  },
});