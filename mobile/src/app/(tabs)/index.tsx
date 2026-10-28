import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuroraBackground } from '@/components/ui/aurora-background';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { RiskBadge } from '@/components/ui/risk-badge';
import { FadeInUp } from '@/components/ui/micro-motion';
import { Typography } from '@/components/ui/typography';
import { Radius, Size, Spacing } from '@/constants/theme';
import { GuestBanner } from '@/features/auth/presentation/guest-banner';
import { fetchScanHistory } from '@/features/scan/data/scan-api';
import type { HistoryItem } from '@/features/scan/domain/types';
import { useScanFlow } from '@/features/scan/presentation/scan-context';
import { analytics } from '@/features/scan/analytics';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const router = useRouter();
  const { prepareImage, state } = useScanFlow();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [recent, setRecent] = useState<HistoryItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoadingRecent(true);
      fetchScanHistory({ limit: 6 })
        .then((res) => {
          if (active) setRecent(res.items);
        })
        .catch(() => {
          if (active) setRecent([]);
        })
        .finally(() => {
          if (active) setLoadingRecent(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

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

  const quota = state.quota;
  const showRecent = !loadingRecent && recent.length > 0;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.five },
      ]}>
      <AuroraBackground />

      <FadeInUp style={styles.header}>
        <Typography variant="display" align="center" themeColor="text">
          LifeLens
        </Typography>
        <Typography variant="subheadline" align="center" themeColor="textSecondary">
          Point. Understand. Act.
        </Typography>
        {quota && (
          <View
            style={[styles.quotaChip, { borderColor: theme.hairline, backgroundColor: theme.glassTint }]}
            accessibilityLabel={`${quota.remaining} scans remaining today`}>
            <Typography variant="caption" themeColor="textSecondary">
              {quota.remaining} scans left today
            </Typography>
          </View>
        )}
      </FadeInUp>

      <FadeInUp duration={240} style={styles.actions}>
        <Button
          onPress={openCamera}
          size="lg"
          fullWidth
          style={styles.primaryButton}
          accessibilityLabel="Scan something with the camera"
          accessibilityHint="Opens the camera to scan an object">
          Scan Anything
        </Button>

        <Button
          onPress={openGallery}
          size="lg"
          variant="secondary"
          fullWidth
          accessibilityLabel="Choose an image from the gallery"
          accessibilityHint="Picks a photo from your gallery to scan">
          Choose from Gallery
        </Button>
      </FadeInUp>

      <FadeInUp duration={240} style={styles.bannerSlot}>
        <GuestBanner />
      </FadeInUp>

      {showRecent && (
        <FadeInUp duration={280} style={styles.recentSection}>
          <Typography variant="subheadline" themeColor="text">
            Recent scans
          </Typography>
          <View style={styles.recentGrid}>
            {recent.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/analysis/${item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.risk_level} risk.`}
                style={({ pressed }) => [styles.recentCardWrap, pressed && styles.pressed]}>
                <GlassCard style={styles.recentCard}>
                  <View style={styles.recentHeader}>
                    <Typography variant="body" numberOfLines={1} style={styles.recentTitle}>
                      {item.title}
                    </Typography>
                    <RiskBadge riskLevel={item.risk_level} />
                  </View>
                  <Typography variant="caption" numberOfLines={2} themeColor="textSecondary">
                    {item.moment_headline}
                  </Typography>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        </FadeInUp>
      )}

      {loadingRecent && (
        <FadeInUp duration={200} style={styles.recentSection}>
          <ActivityIndicator size="small" color={theme.accent} />
        </FadeInUp>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Size.xxl,
    gap: Size.xxxl,
  },
  header: {
    alignItems: 'center',
    gap: Size.xs,
    width: '100%',
    marginTop: Size.xxxl,
  },
  quotaChip: {
    marginTop: Size.sm,
    paddingHorizontal: Size.md,
    paddingVertical: Size.xs,
    borderRadius: Radius.featured,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    width: '100%',
    gap: Size.md,
    maxWidth: 360,
  },
  bannerSlot: {
    width: '100%',
    maxWidth: 360,
  },
  primaryButton: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  recentSection: {
    width: '100%',
    maxWidth: 360,
    gap: Size.md,
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  recentCardWrap: {
    width: '100%',
  },
  recentCard: {
    borderRadius: Radius.elevated,
    padding: Spacing.four,
    gap: Size.sm,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  recentTitle: { flex: 1 },
  pressed: { opacity: 0.8 },
});