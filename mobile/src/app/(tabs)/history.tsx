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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RiskBadge } from '@/components/ui/risk-badge';
import { getOrCreateGuestSessionId } from '@/features/scan/data/guest-session';
import { fetchScanHistory } from '@/features/scan/data/scan-api';
import type { HistoryItem } from '@/features/scan/domain/types';
import { Spacing } from '@/constants/theme';
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
      const sessionId = await getOrCreateGuestSessionId();
      const res = await fetchScanHistory(sessionId, { limit: 50 });
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
    <ThemedView style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <ThemedText type="title">History</ThemedText>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      )}

      {!loading && error && (
        <View style={styles.centered}>
          <ThemedText type="default" themeColor="textSecondary">
            {error}
          </ThemedText>
          <Pressable onPress={() => void load()} style={styles.retryButton}>
            <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
              Retry
            </ThemedText>
          </Pressable>
        </View>
      )}

      {!loading && !error && items.length === 0 && (
        <View style={styles.centered}>
          <ThemedText type="default" themeColor="textSecondary">
            No scans yet. Point your camera at something to get started.
          </ThemedText>
        </View>
      )}

      {!loading && !error && items.length > 0 && (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + Spacing.six },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
          }>
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onItemPress(item)}
              style={[styles.item, { backgroundColor: theme.surface }]}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.risk_level} risk.`}>
              <View style={styles.itemHeader}>
                <ThemedText type="default" numberOfLines={1} style={styles.itemTitle}>
                  {item.title}
                </ThemedText>
                <RiskBadge riskLevel={item.risk_level} />
              </View>
              <ThemedText type="small" numberOfLines={2} themeColor="textSecondary">
                {item.moment_headline}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.itemMeta}>
                {item.category}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  list: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  item: {
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: { flex: 1, marginRight: Spacing.two },
  itemMeta: { marginTop: Spacing.one },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
  },
});
