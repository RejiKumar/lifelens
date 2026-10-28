export type AuthState = 'loading' | 'authenticated' | 'guest';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  isAnonymous: boolean;
  emailVerified: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser | null;
}

export type AuthFlow =
  | { state: 'loading' }
  | { state: 'authenticated'; user: AuthUser }
  | { state: 'guest'; session: AuthSession | null };

export type AuthFlowAction =
  | { type: 'start' }
  | { type: 'authenticated'; user: AuthUser }
  | { type: 'guest'; session: AuthSession | null }
  | { type: 'signed-out' }
  | { type: 'reset' };

export function authFlowReducer(state: AuthFlow, action: AuthFlowAction): AuthFlow {
  switch (action.type) {
    case 'start':
      return { state: 'loading' };
    case 'authenticated':
      return { state: 'authenticated', user: action.user };
    case 'guest':
      return { state: 'guest', session: action.session };
    case 'signed-out':
    case 'reset':
      return { state: 'guest', session: null };
    default:
      return state;
  }
}

export interface PendingImport {
  scanCount: number | null;
  preservedIdentity: boolean;
}

export interface AuthContextValue {
  state: AuthState;
  user: AuthUser | null;
  pendingImport: PendingImport | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  refreshUser(): Promise<void>;
  dismissImportPrompt(): void;
}