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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { signUp, signInWithGoogle } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const validate = useCallback(() => {
    const nameOk = name.trim().length > 0 && name.trim().length <= 100;
    setNameError(nameOk ? null : 'Enter your name.');
    const emailOk = EMAIL_REGEX.test(email.trim());
    setEmailError(emailOk ? null : 'Enter a valid email address.');
    const passwordOk = PASSWORD_REGEX.test(password);
    setPasswordError(
      passwordOk
        ? null
        : 'Password must be at least 8 characters with an uppercase, a lowercase, and a number.',
    );
    const confirmOk = passwordOk && confirm === password;
    setConfirmError(confirmOk ? null : 'Passwords do not match.');
    return nameOk && emailOk && passwordOk && confirmOk;
  }, [name, email, password, confirm]);

  const applyFailure = useCallback(
    (failure: AuthFailure) => {
      if (failure.code === 'email_exists') {
        setEmailError(failure.message);
        setFormError('An account with that email already exists. Try signing in instead.');
      } else if (failure.code === 'weak_password' || failure.field === 'password') {
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
      await signUp(email.trim(), password, name.trim());
      close();
    } catch (error) {
      applyFailure(error as AuthFailure);
    } finally {
      setSubmitting(false);
    }
  }, [validate, signUp, email, password, name, close, applyFailure]);

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
          <Typography variant="largeTitle">Create your account</Typography>
          <View style={[styles.keepPrompt, { backgroundColor: theme.accent + '1F' }]}>
            <Typography variant="caption" themeColor="textSecondary">
              Want to keep your scans? Create an account and we'll save your history.
            </Typography>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Typography variant="caption" themeColor="textSecondary">Name</Typography>
              <TextInput
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                placeholder="Your name"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Name"
                style={[styles.input, { color: theme.text, borderColor: theme.hairline, backgroundColor: theme.surface }]}
              />
              {nameError && (
                <Typography variant="caption" themeColor="textSecondary" accessibilityRole="alert">
                  {nameError}
                </Typography>
              )}
            </View>

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
                autoComplete="new-password"
                placeholder="Min 8 chars, upper, lower, number"
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

            <View style={styles.field}>
              <Typography variant="caption" themeColor="textSecondary">Confirm password</Typography>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoComplete="new-password"
                placeholder="Repeat your password"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Confirm password"
                style={[styles.input, { color: theme.text, borderColor: theme.hairline, backgroundColor: theme.surface }]}
              />
              {confirmError && (
                <Typography variant="caption" themeColor="textSecondary" accessibilityRole="alert">
                  {confirmError}
                </Typography>
              )}
            </View>

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
              accessibilityLabel="Sign up"
              accessibilityHint="Creates your account and opens LifeLens">
              {submitting ? 'Creating account…' : 'Sign Up'}
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
              accessibilityLabel="Continue with Google"
              accessibilityHint="Opens Google sign-in">
              {googleLoading ? 'Opening Google…' : 'Continue with Google'}
            </Button>

            <View style={styles.switchRow}>
              <Typography variant="caption" themeColor="textSecondary">
                Already have an account?
              </Typography>
              <Pressable
                onPress={() => router.replace('/auth/sign-in')}
                style={styles.link}
                accessibilityRole="button"
                accessibilityLabel="Sign in">
                <Typography variant="body" themeColor="accent">Sign in</Typography>
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
    gap: Spacing.two,
  },
  keepPrompt: {
    borderRadius: Radius.small,
    padding: Spacing.three,
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