import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Typography } from '@/components/ui/typography';
import { Size, Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/features/scan/presentation/use-reduced-motion';

interface SignUpPromptProps {
  visible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
}

export function SignUpPrompt({ visible, title, message, onDismiss }: SignUpPromptProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const goToSignUp = () => {
    onDismiss();
    router.push('/auth/sign-up');
  };

  const goToSignIn = () => {
    onDismiss();
    router.push('/auth/sign-in');
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <GlassCard style={styles.card}>
          <Typography variant="title" accessibilityRole="header">
            {title}
          </Typography>
          <Typography variant="body" themeColor="textSecondary">
            {message}
          </Typography>

          <View style={styles.actions}>
            <Button
              onPress={goToSignUp}
              size="lg"
              fullWidth
              accessibilityLabel="Sign up"
              accessibilityHint="Creates an account">
              Sign Up
            </Button>
            <Button
              onPress={goToSignIn}
              size="lg"
              variant="secondary"
              fullWidth
              accessibilityLabel="Sign in instead"
              accessibilityHint="Signs into your existing account">
              Sign In
            </Button>
          </View>

          <Pressable
            onPress={onDismiss}
            style={styles.dismiss}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Typography variant="caption" themeColor="textSecondary">
              Not now
            </Typography>
          </Pressable>
        </GlassCard>
      </View>
    </Modal>
  );
}

export function GuestLimitPrompt({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  return (
    <SignUpPrompt
      visible={visible}
      title="Daily scan limit reached"
      message="You have used all your guest scans for today. Sign up for 20 scans a day — it's free."
      onDismiss={onDismiss}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'center',
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  dismiss: {
    alignSelf: 'center',
    padding: Size.sm,
    minHeight: Size.huge,
    justifyContent: 'center',
  },
});