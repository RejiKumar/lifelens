import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useScanFlow } from '@/features/scan/presentation/scan-context';
import { analytics } from '@/features/scan/analytics';
import { loadFlashPreference, saveFlashPreference } from '@/features/scan/data/flash-preference';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const FLASH_LABELS: Record<FlashMode, string> = {
  off: 'Flash: Off',
  on: 'Flash: On',
  auto: 'Flash: Auto',
  screen: 'Flash: Auto',
};

const FLASH_CYCLE: FlashMode[] = ['off', 'on', 'auto'];

export default function CameraScreen() {
  const router = useRouter();
  const { prepareImage } = useScanFlow();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState<FlashMode>('off');
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  useEffect(() => {
    let active = true;
    loadFlashPreference().then((saved) => {
      if (active) setFlash(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    router.dismiss();
  }, [router]);

  const cycleFlash = useCallback(() => {
    setFlash((current) => {
      const index = FLASH_CYCLE.indexOf(current);
      const next = FLASH_CYCLE[(index + 1) % FLASH_CYCLE.length];
      saveFlashPreference(next);
      return next;
    });
  }, []);

  const onCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    analytics.photoCaptured();
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        exif: false,
      });
      if (!photo) {
        setCapturing(false);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const image = await prepareImage('camera', photo.uri, {
        width: photo.width,
        height: photo.height,
        mimeType: 'image/jpeg',
      });
      if (image) {
        router.dismiss();
        router.push('/preview');
      } else {
        setCapturing(false);
      }
    } catch {
      setCapturing(false);
    }
  }, [capturing, prepareImage, router]);

  const toggleFacing = useCallback(() => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }, []);

  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ThemedText type="default" themeColor="textSecondary" style={styles.permissionMessage}>
          Camera permission is required to scan objects around you.
        </ThemedText>
        <Pressable onPress={requestPermission} style={styles.permissionButton}>
          <ThemedText type="default" style={{ color: '#ffffff' }}>
            Grant Permission
          </ThemedText>
        </Pressable>
        <Pressable onPress={dismiss} style={styles.dismissButton}>
          <ThemedText type="default" themeColor="textSecondary">
            Go Back
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} flash={flash} autofocus="off" />

      <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.topControls}>
          <Pressable
            onPress={dismiss}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close camera">
            <ThemedText type="default" style={styles.closeText}>
              ✕
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={cycleFlash}
            style={styles.flashButton}
            accessibilityRole="button"
            accessibilityLabel={FLASH_LABELS[flash]}
            accessibilityState={{ selected: flash !== 'off' }}>
            <ThemedText type="small" style={styles.flashText}>
              {FLASH_LABELS[flash]}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.bottomControls}>
          <Pressable
            onPress={toggleFacing}
            style={styles.flipButton}
            accessibilityRole="button"
            accessibilityLabel={facing === 'back' ? 'Switch to front camera' : 'Switch to back camera'}>
            <ThemedText type="default" style={styles.flipText}>
              Flip
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={onCapture}
            disabled={capturing}
            style={({ pressed }) => [styles.captureButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Take photo">
            {capturing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </Pressable>

          <View style={styles.flipButton} />
        </View>
      </View>

      <View style={[styles.guideOverlay, { paddingTop: insets.top + Spacing.six }]}>
        <ThemedText type="small" style={styles.guideText}>
          Center the object in the frame
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    gap: Spacing.three,
  },
  permissionMessage: { textAlign: 'center' },
  permissionButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 12,
  },
  dismissButton: { padding: Spacing.two },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
  },
  closeButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#00000066',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#ffffff', fontSize: 20, lineHeight: 22 },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
  },
  flashButton: {
    backgroundColor: '#00000066',
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ffffff' },
  flipButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  flipText: { color: '#ffffff', fontWeight: '600' },
  pressed: { opacity: 0.8 },
  guideOverlay: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  guideText: { color: '#ffffffCC', backgroundColor: '#00000055', paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: 12 },
});