import { act, renderHook, waitFor } from '@testing-library/react-native';

import { AuthProvider, useAuth } from '../auth-context';

type SessionUserFields = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  is_anonymous?: boolean;
  user_metadata?: Record<string, unknown>;
};

type SessionLike = { access_token: string; refresh_token: string; user: SessionUserFields };
type Handler = (event: string, session: SessionLike | null) => void;

class FakeSupabaseAuth {
  session: SessionLike | null = null;
  listeners: Handler[] = [];
  signInAnonymously = jest.fn(async () => {
    this.session = anonSession();
    return { data: { session: this.session, user: this.session.user }, error: null };
  });
  signInWithPassword = jest.fn(async () => ({
    data: { user: null, session: null },
    error: null,
  }));
  updateUser = jest.fn(async (attrs: Record<string, unknown>) => {
    if (this.session && 'email' in attrs) {
      this.session = {
        ...this.session,
        user: {
          ...this.session.user,
          email: attrs.email as string,
          user_metadata: attrs.data as Record<string, unknown> | undefined,
          is_anonymous: false,
        },
      };
      this.emit('USER_UPDATED', this.session);
    }
    return { data: { user: this.session?.user ?? null }, error: null };
  });
  signOut = jest.fn(async () => {
    this.session = null;
    return { error: null };
  });
  getSession = jest.fn(async () => ({ data: { session: this.session }, error: null }));
  getUser = jest.fn(async () => ({ data: { user: this.session?.user ?? null }, error: null }));
  onAuthStateChange = jest.fn((cb: Handler) => {
    this.listeners.push(cb);
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  startAutoRefresh = jest.fn();
  stopAutoRefresh = jest.fn();
  refreshSession = jest.fn(async () => ({ data: { session: this.session }, error: null }));
  linkIdentity = jest.fn(async () => ({ data: null, error: null }));
  signInWithOAuth = jest.fn(async () => ({ data: null, error: null }));
  exchangeCodeForSession = jest.fn(async () => ({ error: null }));

  emit(event: string, session: SessionLike | null = this.session): void {
    for (const cb of [...this.listeners]) cb(event, session);
  }
}

function anonSession(): SessionLike {
  return {
    access_token: 'tok-anon',
    refresh_token: 'ref-anon',
    user: { id: 'u-anon', email: null, is_anonymous: true },
  };
}

function emailSession(): SessionLike {
  return {
    access_token: 'tok-email',
    refresh_token: 'ref-email',
    user: {
      id: 'u-1',
      email: 'alice@example.com',
      email_confirmed_at: '2026-01-01T00:00:00Z',
      is_anonymous: false,
      user_metadata: { name: 'Alice' },
    },
  };
}

let mockFakeAuth: FakeSupabaseAuth | null = null;

jest.mock('@/features/auth/data/supabase-client', () => ({
  supabaseClient: jest.fn(() => {
    if (!mockFakeAuth) throw new Error('supabaseClient called before mockFakeAuth was set');
    return { auth: mockFakeAuth };
  }),
}));

jest.mock('@/features/auth/data/token-provider', () => {
  let expiryListener: (() => void) | null = null;
  return {
    subscribeToSessionExpiry: (listener: () => void) => {
      expiryListener = listener;
      return () => {
        expiryListener = null;
      };
    },
    __emitExpiry: () => expiryListener?.(),
  };
});

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `lifelens://${path}`),
}));
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(async () => ({ type: 'cancel' })),
}));

function makeAuth(): FakeSupabaseAuth {
  return new FakeSupabaseAuth();
}

async function flushEffects(): Promise<void> {
  await act(async () => {});
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFakeAuth = makeAuth();
  });

  it('bootstraps an anonymous guest when no session exists', async () => {
    const auth = mockFakeAuth as FakeSupabaseAuth;
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });

    await flushEffects();
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('loading');

    await act(async () => {
      auth.emit('SIGNED_IN', anonSession());
    });
    await waitFor(() => expect(result.current.state).toBe('guest'));
    expect(result.current.user).toBeNull();
  });

  it('restores an existing anonymous session without re-signing-in', async () => {
    const auth = mockFakeAuth as FakeSupabaseAuth;
    auth.session = anonSession();
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });

    await flushEffects();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();

    await act(async () => {
      auth.emit('INITIAL_SESSION', anonSession());
    });
    await waitFor(() => expect(result.current.state).toBe('guest'));
  });

  it('maps an existing authenticated session to the authenticated state', async () => {
    const auth = mockFakeAuth as FakeSupabaseAuth;
    auth.session = emailSession();
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });

    await flushEffects();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();

    await act(async () => {
      auth.emit('INITIAL_SESSION', emailSession());
    });
    await waitFor(() => expect(result.current.state).toBe('authenticated'));
    expect(result.current.user).toMatchObject({
      id: 'u-1',
      email: 'alice@example.com',
      name: 'Alice',
      emailVerified: true,
    });
  });

  it('signs out back to a fresh anonymous guest session', async () => {
    const auth = mockFakeAuth as FakeSupabaseAuth;
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });

    await flushEffects();
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    await act(async () => {
      auth.emit('SIGNED_IN', anonSession());
    });
    await waitFor(() => expect(result.current.state).toBe('guest'));

    await act(async () => {
      await result.current.signOut();
      auth.emit('SIGNED_OUT', null);
    });
    await waitFor(() => expect(result.current.state).toBe('guest'));
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(2);
  });

  it('returns to guest and re-bootstraps when the session expires', async () => {
    const auth = mockFakeAuth as FakeSupabaseAuth;
    auth.session = emailSession();
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });

    await flushEffects();
    await act(async () => {
      auth.emit('INITIAL_SESSION', emailSession());
    });
    await waitFor(() => expect(result.current.state).toBe('authenticated'));

    const tokenProvider = jest.requireMock('@/features/auth/data/token-provider') as {
      __emitExpiry: () => void;
    };
    await act(async () => {
      tokenProvider.__emitExpiry();
    });
    await waitFor(() => expect(result.current.state).toBe('guest'));
    expect(auth.signInAnonymously).toHaveBeenCalled();
  });

  it('shows an import prompt when a guest upgrades via sign-up', async () => {
    const auth = mockFakeAuth as FakeSupabaseAuth;
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });

    await flushEffects();
    await act(async () => {
      auth.emit('SIGNED_IN', anonSession());
    });
    await waitFor(() => expect(result.current.state).toBe('guest'));

    await act(async () => {
      await result.current.signUp('alice@example.com', 'Password123', 'Alice');
    });

    await waitFor(() => expect(result.current.state).toBe('authenticated'));
    expect(result.current.user?.email).toBe('alice@example.com');
    await waitFor(() =>
      expect(result.current.pendingImport).toEqual({
        scanCount: null,
        preservedIdentity: true,
      }),
    );

    await act(async () => {
      result.current.dismissImportPrompt();
    });
    expect(result.current.pendingImport).toBeNull();
  });

  it('keeps the current anonymous session through refreshUser', async () => {
    const auth = mockFakeAuth as FakeSupabaseAuth;
    auth.session = anonSession();
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });

    await flushEffects();
    await act(async () => {
      auth.emit('INITIAL_SESSION', anonSession());
    });
    await waitFor(() => expect(result.current.state).toBe('guest'));

    await act(async () => {
      await result.current.refreshUser();
    });
    expect(result.current.state).toBe('guest');
  });
});