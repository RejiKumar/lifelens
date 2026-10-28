import { authFlowReducer, type AuthUser } from '../auth-types';

const user: AuthUser = {
  id: 'u1',
  email: 'a@b.com',
  name: 'Alice',
  avatarUrl: null,
  isAnonymous: false,
  emailVerified: true,
};

const anonUser: AuthUser = {
  id: 'u-anon',
  email: null,
  name: null,
  avatarUrl: null,
  isAnonymous: true,
  emailVerified: false,
};

describe('authFlowReducer', () => {
  it('starts in loading and maps guest/authenticated transitions', () => {
    expect(authFlowReducer({ state: 'loading' }, { type: 'authenticated', user })).toEqual({
      state: 'authenticated',
      user,
    });
    expect(
      authFlowReducer(
        { state: 'loading' },
        { type: 'guest', session: { accessToken: 'a', refreshToken: 'r', user: anonUser } },
      ),
    ).toEqual({ state: 'guest', session: { accessToken: 'a', refreshToken: 'r', user: anonUser } });
  });

  it('ignores unknown actions', () => {
    const state = { state: 'guest', session: null } as const;
    expect(
      authFlowReducer(state, { type: 'unknown' } as never),
    ).toBe(state);
  });

  it('maps signed-out/reset back to guest', () => {
    const authenticated = { state: 'authenticated', user } as const;
    expect(authFlowReducer(authenticated, { type: 'signed-out' })).toEqual({
      state: 'guest',
      session: null,
    });
    expect(authFlowReducer(authenticated, { type: 'reset' })).toEqual({
      state: 'guest',
      session: null,
    });
  });
});