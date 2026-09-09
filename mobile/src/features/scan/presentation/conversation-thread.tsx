import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ChatMessage } from '../domain/types';
import { useTheme } from '@/hooks/use-theme';
import { useReducedMotion } from './use-reduced-motion';

export interface ConversationThreadProps {
  messages: ChatMessage[];
}

export function ConversationThread({ messages }: ConversationThreadProps) {
  return (
    <View style={styles.thread} accessibilityRole="none">
      {messages.map((message, index) => (
        <MessageBubble key={message.id ?? `${message.role}-${index}`} message={message} />
      ))}
    </View>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const isUser = message.role === 'user';

  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion]);

  const bubbleStyle = [
    styles.bubble,
    { backgroundColor: isUser ? theme.backgroundSelected : theme.surface },
    isUser ? styles.userBubble : styles.assistantBubble,
  ];

  return (
    <Animated.View
      accessible
      accessibilityLabel={`${isUser ? 'You asked' : 'LifeLens answered'}: ${message.content}`}
      style={[bubbleStyle, { opacity }]}>
      <ThemedText type="small" style={styles.messageText}>
        {message.content}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  thread: {
    gap: Spacing.two,
  },
  bubble: {
    borderRadius: 18,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderTopRightRadius: 6,
    maxWidth: '85%',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderTopLeftRadius: 6,
    maxWidth: '85%',
  },
  messageText: {
    lineHeight: 22,
  },
});