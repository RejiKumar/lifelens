import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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
  const [text, setText] = useState('');
  const blocked = sending || disabled;

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || blocked) return;
    setText('');
    onSubmit(trimmed);
  };

  return (
    <View style={[styles.composer, { backgroundColor: theme.surface }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        editable={!blocked}
        returnKeyType="send"
        onSubmitEditing={submit}
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        accessibilityLabel="Follow-up question"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send question"
        accessibilityHint="Sends your follow-up question about this scan"
        disabled={blocked || text.trim().length === 0}
        onPress={submit}
        style={({ pressed }) => [
          styles.sendButton,
          { backgroundColor: theme.text },
          pressed && !blocked && styles.sendPressed,
          (blocked || text.trim().length === 0) && styles.sendDisabled,
        ]}>
        <ThemedText type="smallBold" style={styles.sendLabel}>
          {sending ? '…' : '↑'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendPressed: {
    opacity: 0.7,
  },
  sendDisabled: {
    opacity: 0.4,
  },
  sendLabel: {
    color: '#ffffff',
  },
});