import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { ChatHistoryResponse, ChatMessage, QuotaInfo } from '../domain/types';
import { type LifeLensError, toLifeLensError } from '../domain/errors';
import { fetchChatHistory, postFollowUp } from '../data/scan-api';
import { getOrCreateGuestSessionId } from '../data/guest-session';

export type ConversationStatus = 'idle' | 'loading' | 'ready' | 'sending' | 'error';
export type ConversationErrorKind = 'history' | 'send';

export interface UseConversationResult {
  messages: ChatMessage[];
  status: ConversationStatus;
  lastError: LifeLensError | null;
  errorKind: ConversationErrorKind | null;
  remainingCapacity: number;
  quota: QuotaInfo | null;
  send(question: string): Promise<void>;
  retry(): Promise<void>;
  reload(): Promise<void>;
}

export function useConversation(analysisId: string | null | undefined): UseConversationResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [lastError, setLastError] = useState<LifeLensError | null>(null);
  const [errorKind, setErrorKind] = useState<ConversationErrorKind | null>(null);
  const [remainingCapacity, setRemainingCapacity] = useState(0);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const pendingQuestionRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  const reload = useCallback(async () => {
    if (!analysisId) return;
    setStatus((current) => (current === 'idle' ? 'loading' : current));
    setLastError(null);
    setErrorKind(null);
    try {
      const sessionId = await getOrCreateGuestSessionId();
      const history: ChatHistoryResponse = await fetchChatHistory(analysisId, sessionId);
      setMessages(history.messages);
      setRemainingCapacity(history.remaining_capacity);
      setQuota(history.quota);
      setStatus('ready');
    } catch (error) {
      setLastError(toLifeLensError(error));
      setErrorKind('history');
      setStatus('error');
    }
  }, [analysisId]);

  useEffect(() => {
    if (analysisId) void reload();
    return () => {
      pendingQuestionRef.current = null;
      busyRef.current = false;
    };
  }, [analysisId, reload]);

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!analysisId || !trimmed || busyRef.current) return;
      busyRef.current = true;
      pendingQuestionRef.current = trimmed;
      setStatus('sending');
      setLastError(null);
      setErrorKind(null);
      try {
        const sessionId = await getOrCreateGuestSessionId();
        const response = await postFollowUp(analysisId, trimmed, sessionId);
        setMessages((current) => [...current, response.message]);
        setRemainingCapacity(response.remaining_capacity);
        setQuota(response.quota);
        setStatus('ready');
        AccessibilityInfo.announceForAccessibility(
          `Answer is ready. ${response.message.content}`,
        );
      } catch (error) {
        setLastError(toLifeLensError(error));
        setErrorKind('send');
        setStatus('error');
      } finally {
        busyRef.current = false;
      }
    },
    [analysisId],
  );

  const retry = useCallback(async () => {
    if (errorKind === 'send') {
      await send(pendingQuestionRef.current ?? '');
    } else if (errorKind === 'history') {
      await reload();
    }
  }, [errorKind, reload, send]);

  return {
    messages,
    status,
    lastError,
    errorKind,
    remainingCapacity,
    quota,
    send,
    retry,
    reload,
  };
}