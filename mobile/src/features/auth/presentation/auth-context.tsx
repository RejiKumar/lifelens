import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import {
  authFailureFromError,
  isEmailTakenCode,
  isWeakPasswordCode,
  type AuthFailure,
} from '../domain/auth-errors';
import type { AuthState, AuthUser, AuthContextValue, PendingImport } from '../domain/auth-types';
import { authFlowReducer } from '../domain/auth-types';
import { supabaseClient } from '../data/supabase-client';
import { subscribeToSessionExpiry } from '../data/token-provider';

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(u: {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  is_anonymous?: boolean;
  user_metadata?: { name?: string; full_name?: string; avatar_url?: string };
}): AuthUser {
  const meta = u.user_metadata ?? {};
  return {
    id: u.id,
    email: u.email ?? null,
    name: meta.name ?? meta.full_name ?? null,
    avatarUrl: meta.avatar_url ?? null,
    isAnonymous: u.is_anonymous ?? false,
    emailVerified: !!u.email_confirmed_at,
  };
}

async function safeClient() {
  try {
    return supabaseClient();
  } catch {
    return null;
  }
}

function extractOAuthCode(url: string): string | null {
  const match = /[?&]code=([^&]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [flow, dispatch] = useReducer(authFlowReducer, { state: 'loading' });
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const stateRef = useRef<AuthState>('loading');
  const upgraderRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    stateRef.current = flow.state;
  }, [flow]);

  const ensureAnonymous = async () => {
    const client = await safeClient();
    if (!client || !mountedRef.current) return;
    try {
      await client.auth.signInAnonymously();
    } catch {
      if (mountedRef.current) dispatch({ type: 'guest', session: null });
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    let cleanup: () => void = () => {};
    let cancelled = false;

    const start = async () => {
      const client = await safeClient();
      if (!client) {
        dispatch({ type: 'guest', session: null });
        return;
      }

      const { data: subData } = client.auth.onAuthStateChange((event, session) => {
        if (!mountedRef.current) return;
        if (event === 'SIGNED_OUT') {
          dispatch({ type: 'guest', session: null });
          void ensureAnonymous();
          return;
        }
        if (!session?.user) {
          if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            void ensureAnonymous();
          }
          return;
        }
        const prev = stateRef.current;
        if (session.user.is_anonymous) {
          dispatch({
            type: 'guest',
            session: {
              accessToken: session.access_token,
              refreshToken: session.refresh_token,
              user: toAuthUser(session.user),
            },
          });
          return;
        }
        dispatch({ type: 'authenticated', user: toAuthUser(session.user) });
        if (upgraderRef.current && prev === 'guest') {
          upgraderRef.current = false;
          setPendingImport({ scanCount: null, preservedIdentity: true });
        }
      });

      cleanup = () => {
        subData.subscription.unsubscribe();
      };

      const { data } = await client.auth.getSession();
      if (cancelled) return;
      if (!data.session?.user) {
        await ensureAnonymous();
      }
    };

    start().catch(() => {
      if (mountedRef.current) dispatch({ type: 'guest', session: null });
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      cleanup();
    };
  }, []);

  useEffect(() => {
    const unsubscribeBus = subscribeToSessionExpiry(() => {
      if (!mountedRef.current) return;
      upgraderRef.current = false;
      dispatch({ type: 'guest', session: null });
      void ensureAnonymous();
    });
    return unsubscribeBus;
  }, []);

  useEffect(() => {
    let appStateSub: { remove(): void } | null = null;
    let disposed = false;
    (async () => {
      const client = await safeClient();
      if (!client || disposed) return;
      const onChange = (next: string) => {
        if (next === 'active') client.auth.startAutoRefresh();
        else client.auth.stopAutoRefresh();
      };
      appStateSub = AppState.addEventListener('change', onChange);
      client.auth.startAutoRefresh();
    })();
    return () => {
      disposed = true;
      appStateSub?.remove();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const client = supabaseClient();
    upgraderRef.current = false;
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw authFailureFromError(error);
  };

  const signUp = async (email: string, password: string, name: string) => {
    const client = supabaseClient();
    upgraderRef.current = true;
    const { data: current } = await client.auth.getSession();
    const currentUser = current.session?.user;

    if (!currentUser || !currentUser.is_anonymous) {
      const { error } = await client.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw authFailureFromError(error);
      return;
    }

    const { error: emailError } = await client.auth.updateUser({ email, data: { name } });
    if (emailError) {
      if (isEmailTakenCode(emailError.code ?? '')) {
        throw { code: 'email_exists', message: 'An account with that email already exists. Try signing in.' } satisfies AuthFailure;
      }
      throw authFailureFromError(emailError);
    }
    const { error: passwordError } = await client.auth.updateUser({ password });
    if (passwordError && isWeakPasswordCode(passwordError.code ?? '')) {
      throw authFailureFromError(passwordError);
    }
  };

  const signInWithGoogle = async () => {
    const client = supabaseClient();
    upgraderRef.current = true;
    const redirectTo = Linking.createURL('/auth-callback');
    const { data: current } = await client.auth.getUser();
    const isAnonymous = !!current.user?.is_anonymous;
    const result = isAnonymous
      ? await client.auth.linkIdentity({ provider: 'google', options: { redirectTo } })
      : await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (result.error || !result.data) throw authFailureFromError(result.error);

    const browser = await WebBrowser.openAuthSessionAsync(
      typeof result.data === 'string' ? result.data : result.data.url,
      redirectTo,
    );
    if (browser.type !== 'success' || !browser.url) return;
    const code = extractOAuthCode(browser.url);
    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) throw authFailureFromError(error);
    }
  };

  const signOut = async () => {
    const client = await safeClient();
    if (!client) return;
    await client.auth.signOut();
  };

  const refreshUser = async () => {
    const client = await safeClient();
    if (!client) return;
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      if (mountedRef.current) dispatch({ type: 'guest', session: null });
      return;
    }
    if (data.user.is_anonymous) {
      dispatch({ type: 'guest', session: null });
      return;
    }
    dispatch({ type: 'authenticated', user: toAuthUser(data.user) });
  };

  const dismissImportPrompt = () => setPendingImport(null);

  const value: AuthContextValue = {
    state: flow.state,
    user: flow.state === 'authenticated' && 'user' in flow ? flow.user : null,
    pendingImport,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    refreshUser,
    dismissImportPrompt,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return ctx;
}