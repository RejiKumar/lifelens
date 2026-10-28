import { useState } from 'react';
import { Pressable, StyleSheet, Text, type NativeSyntheticEvent, type StyleProp, type TextStyle } from 'react-native';

import { Typography } from '@/components/ui/typography';
import type { TypeStepName } from '@/constants/theme';
import { Size, Typography as TypeScale } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ExpandableTextProps {
  text: string;
  numberOfLines: number;
  variant?: TypeStepName;
  themeColor?: 'text' | 'textSecondary';
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

type TextLayoutEvent = NativeSyntheticEvent<{ lines: Array<{ text: string }> }>;

export function ExpandableText({
  text,
  numberOfLines,
  variant = 'body',
  themeColor = 'text',
  style,
  accessibilityLabel,
}: ExpandableTextProps) {
  const theme = useTheme();
  const [clamped, setClamped] = useState(false);
  const [measuring, setMeasuring] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const handleTextLayout = (event: TextLayoutEvent) => {
    if (!measuring) return;
    if (event.nativeEvent.lines.length > numberOfLines) {
      setClamped(true);
    }
    setMeasuring(false);
  };

  return (
    <>
      <Text
        onTextLayout={handleTextLayout}
        numberOfLines={!measuring && !expanded && clamped ? numberOfLines : undefined}
        style={[{ color: theme[themeColor], ...TypeScale[variant] }, style]}
        accessibilityLabel={accessibilityLabel}>
        {text}
      </Text>
      {clamped && !measuring && (
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? 'Show less' : 'Show more'}
          hitSlop={Size.sm}
          style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}>
          <Typography variant="caption" themeColor="accent">
            {expanded ? 'Show less' : 'Show more'}
          </Typography>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  control: {
    alignSelf: 'flex-start',
    paddingVertical: Size.xs,
    minHeight: 30,
  },
  controlPressed: {
    opacity: 0.7,
  },
});