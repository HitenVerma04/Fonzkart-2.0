import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, type SessionUser } from './auth';
import { setAuthToken } from './client';
import { ACCOUNT_KEY } from './hooks';

/** Where the app keeps the session token (expo-secure-store on phones). */
export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  remove(): Promise<void>;
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: SessionUser };

interface SessionContextValue {
  session: SessionState;
  /** Stores a token the server just issued and loads its user. */
  signIn(token: string): Promise<void>;
  /** Forgets the token on this phone (the server keeps no session list; tokens expire after 7 days). */
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** The user inside a session token, if it has not expired. Used only when the server cannot be reached. */
export function tokenUser(token: string, now = Date.now()): SessionUser | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const binary = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    // base64 gives UTF-8 bytes; percent-decoding turns them back into text (names may have non-ASCII letters).
    const json = decodeURIComponent(binary.split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
    const payload = JSON.parse(json) as { user?: SessionUser; exp?: number };
    if (!payload.user || typeof payload.exp !== 'number' || payload.exp * 1000 <= now) return null;
    return payload.user;
  } catch {
    return null;
  }
}

export function SessionProvider({ storage, children }: { storage: TokenStorage; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<SessionState>({ status: 'loading' });

  const forget = useCallback(async () => {
    setAuthToken(null);
    queryClient.removeQueries({ queryKey: ACCOUNT_KEY });
    setSession({ status: 'signedOut' });
    await storage.remove().catch(() => undefined);
  }, [queryClient, storage]);

  const adopt = useCallback(async (token: string) => {
    setAuthToken(token);
    try {
      const user = await authApi.session();
      if (user) setSession({ status: 'signedIn', user });
      else await forget(); // expired or no longer valid
    } catch {
      const user = tokenUser(token); // offline: trust the unexpired token until the server answers again
      if (user) setSession({ status: 'signedIn', user });
      else await forget();
    }
  }, [forget]);

  useEffect(() => {
    let cancelled = false;
    storage.get()
      .catch(() => null)
      .then(token => {
        if (cancelled) return;
        if (token) void adopt(token);
        else setSession({ status: 'signedOut' });
      });
    return () => { cancelled = true; };
  }, [storage, adopt]);

  const value = useMemo<SessionContextValue>(() => ({
    session,
    signIn: async token => {
      await storage.set(token);
      await adopt(token);
    },
    signOut: forget,
  }), [session, storage, adopt, forget]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
