import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ScanProvider } from '@/features/scan/presentation/scan-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const hideSplash = async () => {
      await SplashScreen.hideAsync();
    };
    hideSplash();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ScanProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="camera"
            options={{ presentation: 'fullScreenModal', headerShown: false }}
          />
          <Stack.Screen name="preview" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen
            name="scan"
            options={{ presentation: 'fullScreenModal', headerShown: false }}
          />
          <Stack.Screen name="analysis/[id]" options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ScanProvider>
    </ThemeProvider>
  );
}