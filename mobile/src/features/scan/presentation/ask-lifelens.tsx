import { StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { PressableScale } from '@/components/ui/micro-motion';
import { Typography } from '@/components/ui/typography';
import { Radius, Size, Spacing } from '@/constants/theme';
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
      <Typography variant="caption" themeColor="accent" style={styles.eyebrow}>
        ASK LIFELENS
      </Typography>
      <Typography variant="title" accessibilityRole="header">
        Ask about what you see
      </Typography>
      <Typography variant="body" themeColor="textSecondary">
        I can answer follow-up questions about this scan. Each question counts toward your daily
        AI limit.
      </Typography>

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
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Ask: ${label}`}
      accessibilityHint="Submits this question about the scan"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: theme.accent + '1F', borderColor: theme.accent + '55' },
        disabled && styles.chipDisabled,
      ]}>
      <Typography variant="caption" style={styles.chipText}>
        {label}
      </Typography>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  eyebrow: {
    letterSpacing: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: Size.md,
    paddingHorizontal: Size.lg,
    minHeight: Size.huge,
    justifyContent: 'center',
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    maxWidth: 280,
  },
});