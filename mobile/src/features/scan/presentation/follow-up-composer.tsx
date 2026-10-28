import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Typography } from '@/components/ui/typography';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface FollowUpComposerProps {
  onSubmit(question: string): void;
  sending?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function FollowUpComposer({
  onSubmit,
  sending = false,
  disabled = false,
  placeholder = 'Ask about what you just scanned…',
}: FollowUpComposerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const blocked = sending || disabled;

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || blocked) return;
    setText('');
    onSubmit(trimmed);
  };

  const canSend = !blocked && text.trim().length > 0;

  return (
    <View
      style={[
        styles.composer,
        {
          backgroundColor: theme.glassTint,
          borderTopColor: theme.hairline,
          paddingBottom: insets.bottom + Size.sm,
        },
      ]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        editable={!blocked}
        returnKeyType="send"
        onSubmitEditing={submit}
        style={[styles.input, { color: theme.text, borderColor: theme.hairline, backgroundColor: theme.surface }]}
        accessibilityLabel="Follow-up question"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send question"
        accessibilityHint="Sends your follow-up question about this scan"
        disabled={!canSend}
        onPress={submit}
        style={({ pressed }) => [
          styles.sendButton,
          { backgroundColor: canSend ? theme.accent : theme.backgroundElement },
          pressed && canSend && styles.sendPressed,
        ]}>
        <Typography variant="subheadline" themeColor={canSend ? 'accentText' : 'textSecondary'} align="center">
          {sending ? '…' : '↑'}
        </Typography>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Size.md,
    paddingTop: Size.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: Size.huge,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.standard,
    paddingHorizontal: Size.lg,
    fontSize: 16,
  },
  sendButton: {
    width: Size.huge,
    height: Size.huge,
    borderRadius: Radius.standard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendPressed: {
    opacity: 0.7,
  },
});