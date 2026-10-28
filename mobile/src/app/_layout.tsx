import { Stack, useRouter } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ScanProvider } from '@/features/scan/presentation/scan-context';
import { AuthProvider, useAuth } from '@/features/auth/presentation/auth-context';
import { hasSeenOnboarding } from '@/features/auth/data/ui-preferences';

SplashScreen.preventAutoHideAsync();

function RootContent() {
  const router = useRouter();
  const { state, pendingImport } = useAuth();
  const resolved = state !== 'loading';

  useEffect(() => {
    if (resolved) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [resolved]);

  useEffect(() => {
    if (!resolved) return;
    const route = (() => {
      if (pendingImport) return '/auth/import-prompt';
      return null;
    })();
    if (route) {
      router.replace(route);
      return;
    }
  }, [resolved, pendingImport, router]);

  useEffect(() => {
    if (!resolved) return;
    let mounted = true;
    void hasSeenOnboarding().then((seen) => {
      if (mounted && state === 'guest' && !seen) {
        router.replace('/onboarding');
      }
    });
    return () => {
      mounted = false;
    };
  }, [resolved, state, router]);

  if (!resolved) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="camera"
        options={{ presentation: 'fullScreenModal', headerShown: false }}
      />
      <Stack.Screen name="preview" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="analysis/[id]" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="auth/sign-in" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="auth/sign-up" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="auth/forgot-password" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="auth-callback" options={{ presentation: 'transparentModal', headerShown: false }} />
      <Stack.Screen name="auth/import-prompt" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <ScanProvider>
          <RootContent />
        </ScanProvider>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </AuthProvider>
    </ThemeProvider>
  );
}