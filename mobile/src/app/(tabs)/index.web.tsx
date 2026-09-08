import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScanFlow } from '@/features/scan/presentation/scan-context';
import { analytics } from '@/features/scan/analytics';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ACCENT = '#3B82F6';

export default function HomeScreenWeb() {
  const router = useRouter();
  const { prepareImage, state } = useScanFlow();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const openCamera = () => {
    analytics.scanStart('camera');
    router.push('/camera');
  };

  const openGallery = async () => {
    analytics.scanStart('gallery');
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

  const pickFromFileInput = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    handleDroppedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onDropzonePress = () => {
    fileInputRef.current?.click();
  };

  const handleDroppedFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    analytics.scanStart('file');
    const objectUrl = URL.createObjectURL(file);
    analytics.photoPicked();
    prepareImage('file', objectUrl, {
      mimeType: file.type,
      fileName: file.name,
    }).then((image) => {
      URL.revokeObjectURL(objectUrl);
      if (image && state.stage !== 'error') {
        router.push('/preview');
      }
    });
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) handleDroppedFile(file);
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(true);
  };

  const webDropzoneProps = {
    onClick: onDropzonePress,
    onDragOver,
    onDragLeave: () => setDragging(false),
    onDrop,
  } as unknown as object;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.six },
      ]}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">LifeLens</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Point. Understand. Act.
        </ThemedText>
      </ThemedView>

      <View
        {...webDropzoneProps}
        style={[styles.dropzone, { borderColor: ACCENT, backgroundColor: dragging ? `${ACCENT}22` : theme.surface }]}
        accessibilityRole="button"
        accessibilityLabel="Upload an image by dragging and dropping it here">
        <ThemedText type="default">Drag &amp; drop an image here</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.dropHint}>
          or click to browse files
        </ThemedText>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={styles.fileInputHidden}
          onChange={pickFromFileInput}
        />
      </View>

      <ThemedView style={styles.actions}>
        <Pressable onPress={openCamera} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <ThemedText type="default" style={styles.primaryText}>
            Scan with Camera
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
    gap: Spacing.five,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  dropzone: {
    width: '100%',
    maxWidth: 360,
    minHeight: 160,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  dropHint: { textAlign: 'center' },
  fileInputHidden: { display: 'none' },
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
