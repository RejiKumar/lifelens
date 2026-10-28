import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { RiskBadge } from '@/components/ui/risk-badge';
import { ThemedScreen } from '@/components/ui/themed-screen';
import { Typography } from '@/components/ui/typography';
import { fetchScanHistory } from '@/features/scan/data/scan-api';
import type { HistoryItem } from '@/features/scan/domain/types';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await fetchScanHistory({ limit: 50 });
      setItems(res.items);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load history';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onItemPress = useCallback(
    (item: HistoryItem) => {
      router.push(`/analysis/${item.id}`);
    },
    [router],
  );

  return (
    <ThemedScreen aurora>
      <View style={[styles.header, { paddingTop: insets.top + Size.sm }]}>
        <Typography variant="largeTitle">History</Typography>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.centered}>
          <Typography variant="body" themeColor="textSecondary" align="center">
            {error}
          </Typography>
          <Button
            onPress={() => void load()}
            accessibilityLabel="Retry loading history"
            accessibilityHint="Tries to load your scan history again">
            Retry
          </Button>
        </View>
      )}

      {!loading && !error && items.length === 0 && (
        <View style={styles.centered}>
          <Typography variant="body" themeColor="textSecondary" align="center">
            No scans yet. Point your camera at something to get started.
          </Typography>
        </View>
      )}

      {!loading && !error && items.length > 0 && (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + Spacing.six },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={theme.accent}
            />
          }>
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onItemPress(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.risk_level} risk.`}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <GlassCard style={styles.item}>
                <View style={styles.itemHeader}>
                  <Typography variant="body" numberOfLines={1} style={styles.itemTitle}>
                    {item.title}
                  </Typography>
                  <RiskBadge riskLevel={item.risk_level} />
                </View>
                <Typography variant="caption" numberOfLines={2} themeColor="textSecondary">
                  {item.moment_headline}
                </Typography>
                <View style={styles.itemMetaRow}>
                  <Typography variant="caption" themeColor="textSecondary">
                    {item.category}
                  </Typography>
                </View>
              </GlassCard>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.four, paddingBottom: Size.sm },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  list: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  item: {
    borderRadius: Radius.elevated,
    padding: Spacing.four,
    gap: Size.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  itemTitle: { flex: 1 },
  itemMetaRow: { flexDirection: 'row' },
  pressed: { opacity: 0.8 },
});