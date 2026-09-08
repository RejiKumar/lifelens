import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScanFlow } from '@/features/scan/presentation/scan-context';
import { analytics } from '@/features/scan/analytics';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const router = useRouter();
  const { prepareImage, state } = useScanFlow();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const openCamera = () => {
    analytics.scanStart('camera');
    router.push('/camera');
  };

  const openGallery = async () => {
    analytics.scanStart('gallery');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      analytics.cameraPermissionDenied();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      exif: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    analytics.photoPicked();
    const image = await prepareImage('gallery', asset.uri, {
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType ?? undefined,
      fileName: asset.fileName ?? undefined,
    });
    if (image && state.stage !== 'error') {
      router.push('/preview');
    }
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.six }]}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">LifeLens</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Point. Understand. Act.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.actions}>
        <Pressable onPress={openCamera} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <ThemedText type="default" style={styles.primaryText}>
            Scan Anything
          </ThemedText>
        </Pressable>

        <Pressable onPress={openGallery} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <ThemedText type="default" themeColor="textSecondary">
            Choose from Gallery
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.six,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  actions: {
    width: '100%',
    gap: Spacing.three,
    maxWidth: 360,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#9CA3AF',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  pressed: { opacity: 0.8 },
});