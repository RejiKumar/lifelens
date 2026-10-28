import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Typography } from '@/components/ui/typography';
import { useScanFlow } from '@/features/scan/presentation/scan-context';
import { analytics } from '@/features/scan/analytics';
import { loadFlashPreference, saveFlashPreference } from '@/features/scan/data/flash-preference';
import { Radius, Size, Spacing } from '@/constants/theme';
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
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Typography variant="body" themeColor="textSecondary" align="center" style={styles.permissionMessage}>
          Camera permission is required to scan objects around you.
        </Typography>
        <Pressable
          onPress={requestPermission}
          accessibilityRole="button"
          accessibilityLabel="Grant camera permission"
          style={({ pressed }) => [styles.permissionButton, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
          <Typography variant="subheadline" themeColor="accentText">
            Grant Permission
          </Typography>
        </Pressable>
        <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Go back" style={styles.dismissButton}>
          <Typography variant="body" themeColor="textSecondary">
            Go Back
          </Typography>
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
            style={[styles.chip, styles.closeButton]}
            accessibilityRole="button"
            accessibilityLabel="Close camera">
            <Typography variant="body" themeColor="onCamera">
              ✕
            </Typography>
          </Pressable>

          <Pressable
            onPress={cycleFlash}
            style={styles.chip}
            accessibilityRole="button"
            accessibilityLabel={FLASH_LABELS[flash]}
            accessibilityState={{ selected: flash !== 'off' }}>
            <Typography variant="caption" themeColor="onCamera" align="center">
              {FLASH_LABELS[flash]}
            </Typography>
          </Pressable>
        </View>

        <View style={styles.bottomControls}>
          <Pressable
            onPress={toggleFacing}
            style={styles.flipTouch}
            accessibilityRole="button"
            accessibilityLabel={facing === 'back' ? 'Switch to front camera' : 'Switch to back camera'}>
            <Typography variant="body" themeColor="onCamera">
              Flip
            </Typography>
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

          <View style={styles.flipTouch} />
        </View>
      </View>

      <View style={[styles.guideOverlay, { paddingTop: insets.top + Spacing.five }]}>
        <View style={styles.guidePill}>
          <Typography variant="caption" themeColor="onCamera" align="center">
            Center the object in the frame
          </Typography>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
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
    minHeight: Size.xxxl,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.standard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButton: { padding: Size.xl },
  pressed: { opacity: 0.8 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Size.huge,
    minWidth: Size.huge,
    borderRadius: Radius.featured,
    backgroundColor: 'rgba(17, 17, 19, 0.45)',
    paddingHorizontal: Spacing.three,
  },
  closeButton: {
    width: Size.huge,
    paddingHorizontal: 0,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
  },
  captureButton: {
    width: Size.xhuge,
    height: Size.xhuge,
    borderRadius: Size.xxxl,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: Size.huge,
    height: Size.huge,
    borderRadius: Size.xxxl,
    backgroundColor: '#ffffff',
  },
  flipTouch: {
    width: Size.xhuge,
    height: Size.xhuge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideOverlay: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  guidePill: {
    backgroundColor: 'rgba(17, 17, 19, 0.4)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Size.sm,
    borderRadius: Radius.standard,
  },
});