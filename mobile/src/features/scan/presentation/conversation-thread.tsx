import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Typography } from '@/components/ui/typography';
import { Radius, Size, Spacing } from '@/constants/theme';
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
    isUser
      ? { backgroundColor: theme.accent, borderColor: theme.accent }
      : { backgroundColor: theme.glassTint, borderColor: theme.hairline },
    isUser ? styles.userBubble : styles.assistantBubble,
  ];

  return (
    <Animated.View
      accessible
      accessibilityLabel={`${isUser ? 'You asked' : 'LifeLens answered'}: ${message.content}`}
      style={[bubbleStyle, { opacity }]}>
      <Typography variant="body" themeColor={isUser ? 'accentText' : 'text'} style={styles.messageText}>
        {message.content}
      </Typography>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  thread: {
    gap: Spacing.two,
  },
  bubble: {
    borderRadius: Radius.standard,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Size.md,
    paddingHorizontal: Size.lg,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderTopRightRadius: Size.xs + Size.min,
    maxWidth: '85%',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderTopLeftRadius: Size.xs + Size.min,
    maxWidth: '85%',
  },
  messageText: {
    lineHeight: 22,
  },
});