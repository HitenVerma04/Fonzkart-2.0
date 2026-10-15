// Who is using the Partner app. One app, two modes chosen by how the person signs in:
//   field executive  phone + password (the website's executive login)  → rider mode
//   partner          email/phone + password with role PARTNER          → partner mode
// Other staff (admins, zonal heads, RMs) use the Admin app. The token is kept in the phone's secure storage.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, executiveApi, setAuthToken, tokenUser, type Executive, type SessionUser } from '@fonzkart/api';

const KEY = 'fonzkart.partner.session';

type Stored = { kind: 'executive' | 'partner'; token: string };

export type PartnerSession =
  | { status: 'loading' }
  | { status: 'signedOut'; notice?: string }
  | { status: 'executive'; executive: Executive }
  | { status: 'partner'; user: SessionUser };

const storage = Platform.OS === 'web'
  ? {
      get: async () => globalThis.localStorage?.getItem(KEY) ?? null,
      set: async (value: string) => globalThis.localStorage?.setItem(KEY, value),
      remove: async () => globalThis.localStorage?.removeItem(KEY),
    }
  : {
      get: () => SecureStore.getItemAsync(KEY),
      set: (value: string) => SecureStore.setItemAsync(KEY, value),
      remove: () => SecureStore.deleteItemAsync(KEY),
    };

interface Value {
  session: PartnerSession;
  signIn(kind: Stored['kind'], token: string): Promise<void>;
  signOut(notice?: string): Promise<void>;
}

const Context = createContext<Value | null>(null);

export function PartnerSessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [session, setSession] = useState<PartnerSession>({ status: 'loading' });

  const signOut = useCallback(async (notice?: string) => {
    setAuthToken(null);
    client.clear();
    setSession({ status: 'signedOut', notice });
    await storage.remove().catch(() => undefined);
  }, [client]);

  const adopt = useCallback(async ({ kind, token }: Stored) => {
    setAuthToken(token);
    try {
      if (kind === 'executive') {
        const executive = await executiveApi.session();
        if (executive) setSession({ status: 'executive', executive });
        else await signOut('Your session ended. Please sign in again.');
        return;
      }
      const user = await authApi.session();
      if (!user) await signOut('Your session ended. Please sign in again.');
      else if (user.role !== 'PARTNER') await signOut(STAFF_ELSEWHERE);
      else setSession({ status: 'partner', user });
    } catch {
      // Offline: a partner token still names its user; an executive keeps working once the server answers.
      const user = kind === 'partner' ? tokenUser(token) : null;
      if (user?.role === 'PARTNER') setSession({ status: 'partner', user });
      else setSession({ status: 'signedOut', notice: 'Could not reach Fonzkart. Check your internet connection.' });
    }
  }, [signOut]);

  useEffect(() => {
    storage.get().catch(() => null).then(raw => {
      const stored = parse(raw);
      if (stored) void adopt(stored);
      else setSession({ status: 'signedOut' });
    });
  }, [adopt]);

  const value = useMemo<Value>(() => ({
    session,
    signIn: async (kind, token) => {
      await storage.set(JSON.stringify({ kind, token }));
      await adopt({ kind, token });
    },
    signOut,
  }), [session, adopt, signOut]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const STAFF_ELSEWHERE = 'This app is for partners and field executives. Admins, zonal heads and relationship managers use the Fonzkart Admin app.';

function parse(raw: string | null): Stored | null {
  try {
    const value = raw ? (JSON.parse(raw) as Stored) : null;
    return value && (value.kind === 'executive' || value.kind === 'partner') && typeof value.token === 'string' ? value : null;
  } catch {
    return null;
  }
}

export function usePartnerSession(): Value {
  const value = useContext(Context);
  if (!value) throw new Error('usePartnerSession must be used inside PartnerSessionProvider');
  return value;
}
