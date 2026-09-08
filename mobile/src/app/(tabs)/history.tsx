import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { StyleSheet } from 'react-native';

export default function HistoryStub() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">History</ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        Your scan history will appear here.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
});