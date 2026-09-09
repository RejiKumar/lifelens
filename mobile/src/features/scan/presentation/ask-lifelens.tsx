import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { GlassCard } from '@/components/ui/glass-card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface AskLifeLensCardProps {
  suggestions: string[];
  onAsk(question: string): void;
  disabled?: boolean;
}

export function AskLifeLensCard({ suggestions, onAsk, disabled = false }: AskLifeLensCardProps) {
  const theme = useTheme();
  const chips = suggestions
    .filter((item) => item.trim().length > 0)
    .slice(0, 2);

  return (
    <GlassCard style={styles.card}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.eyebrow}>
        ASK LIFELENS
      </ThemedText>
      <ThemedText type="subtitle" accessibilityRole="header" style={styles.headline}>
        Ask about what you see
      </ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        I can answer follow-up questions about this scan. Each question counts toward your daily
        AI limit.
      </ThemedText>

      {chips.length > 0 && (
        <View style={styles.chips} accessibilityRole="none">
          {chips.map((suggestion, index) => (
            <PressableChip
              key={`${index}-${suggestion}`}
              label={suggestion}
              disabled={disabled}
              onPress={() => onAsk(suggestion)}
            />
          ))}
        </View>
      )}
    </GlassCard>
  );
}

function PressableChip({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress(): void;
  disabled: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ask: ${label}`}
      accessibilityHint="Submits this question about the scan"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: theme.surface, borderColor: theme.backgroundElement },
        pressed && !disabled && styles.chipPressed,
        disabled && styles.chipDisabled,
      ]}>
      <ThemedText type="small" style={styles.chipText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  eyebrow: {
    letterSpacing: 2,
  },
  headline: {
    fontSize: 24,
    lineHeight: 32,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    maxWidth: 280,
  },
});