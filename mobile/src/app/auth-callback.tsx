import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedScreen } from '@/components/ui/themed-screen';
import { Typography } from '@/components/ui/typography';
import { Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabaseClient } from '@/features/auth/data/supabase-client';

function extractCode(params: Record<string, string | string[] | undefined>): string | null {
  const raw = params.code;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return null;
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    const code = extractCode(params);
    if (!code) {
      setError('No session was provided by the sign-in link.');
      return;
    }
    void (async () => {
      try {
        const client = supabaseClient();
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError('This sign-in link is invalid or expired.');
          return;
        }
        router.replace('/');
      } catch {
        setError('This sign-in link is invalid or expired.');
      }
    })();
  }, [params, router]);

  return (
    <ThemedScreen aurora>
      <View style={styles.content}>
        {error ? (
          <Typography variant="body" themeColor="textSecondary" align="center" accessibilityRole="alert">
            {error}
          </Typography>
        ) : (
          <>
            <ActivityIndicator size="large" color={theme.accent} />
            <Typography variant="body" themeColor="textSecondary">
              Finishing sign-in…
            </Typography>
          </>
        )}
      </View>
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Size.lg,
    padding: Spacing.four,
  },
});