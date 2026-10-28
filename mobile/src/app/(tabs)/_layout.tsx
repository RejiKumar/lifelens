import {
  TabList,
  TabSlot,
  TabTrigger,
  Tabs,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/micro-motion';
import { Typography } from '@/components/ui/typography';
import { Radius, Size } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <Tabs style={[{ backgroundColor: theme.background }, styles.root]}>
      <TabSlot style={[styles.slot, { paddingBottom: Size.huge + Size.sm }]} />

      <TabList asChild>
        <FixedTabBar bottomInset={insets.bottom}>
          <TabTrigger name="index" href="/" asChild>
            <TabButton label="Home" />
          </TabTrigger>
          <TabTrigger name="history" href="/history" asChild>
            <TabButton label="History" />
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton label="Settings" />
          </TabTrigger>
        </FixedTabBar>
      </TabList>
    </Tabs>
  );
}

interface FixedTabBarProps {
  children: ReactNode;
  bottomInset: number;
}

function FixedTabBar({ children, bottomInset }: FixedTabBarProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.barContainer,
        {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.hairline,
          paddingBottom: bottomInset,
        },
      ]}>
      {children}
    </View>
  );
}

type TabButtonProps = TabTriggerSlotProps & { label: string };

function TabButton({ label, isFocused, ...props }: TabButtonProps) {
  return (
    <PressableScale
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={`${label} tab`}
      style={styles.tabButton}>
      <Typography
        variant="caption"
        themeColor={isFocused ? 'accent' : 'text'}
        style={styles.tabLabel}>
        {label}
      </Typography>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slot: { flex: 1 },
  barContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: Size.sm,
    paddingHorizontal: Size.sm,
    paddingTop: Size.sm,
    alignItems: 'center',
    borderTopLeftRadius: Radius.featured,
    borderTopRightRadius: Radius.featured,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -Size.sm },
    shadowOpacity: 0.15,
    shadowRadius: Size.lg,
  },
  tabButton: {
    flex: 1,
    minHeight: Size.huge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    textAlign: 'center',
  },
});