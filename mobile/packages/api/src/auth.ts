// Customer sign-in, sign-up with email code, and password reset (backend/README.md, "Auth API"). The bodies are the
// website's server-action results; `redirectTo` tells where the website would go next.
import { request, type ApiResponse } from './client';

interface ActionBody {
  error?: string;
  redirectTo?: string;
  success?: string | boolean;
}

export type AuthOutcome =
  | { kind: 'signedIn'; token: string }
  | { kind: 'verifyEmail'; email: string }
  | { kind: 'error'; message: string };

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Profile extends SessionUser {
  phone: string | null;
}

const UNEXPECTED = 'Unexpected answer from the server. Please try again.';

/** Maps a sign-in style response to what the app does next. */
export function authOutcome(response: ApiResponse<ActionBody | null>, email: string): AuthOutcome {
  const body = response.data ?? {};
  if (body.error) return { kind: 'error', message: body.error };
  if (response.authToken) return { kind: 'signedIn', token: response.authToken };
  if (body.redirectTo?.startsWith('/verify-email')) {
    const match = /[?&]email=([^&]*)/.exec(body.redirectTo);
    return { kind: 'verifyEmail', email: match ? decodeURIComponent(match[1]!) : email };
  }
  return { kind: 'error', message: UNEXPECTED };
}

function post(path: string, body: unknown) {
  return request<ActionBody | null>('POST', path, { body, issuesToken: true });
}

export const authApi = {
  /** Email or phone number + password. An unverified account gets a new code and must verify first. */
  signIn: async (emailOrPhone: string, password: string) =>
    authOutcome(await post('/api/auth/signin', { email: emailOrPhone.trim(), password }), emailOrPhone.trim()),

  /** Creates an unverified account and emails a 6-digit code (valid 15 minutes). */
  signUp: async (input: { name: string; email: string; phone: string; password: string }) =>
    authOutcome(
      await post('/api/auth/signup', { ...input, name: input.name.trim(), email: input.email.trim(), phone: input.phone.trim() }),
      input.email.trim(),
    ),

  verifyEmail: async (email: string, otp: string) =>
    authOutcome(await post('/api/auth/verify-email', { email, otp: otp.trim() }), email),

  /** Emails a 6-digit reset code to a registered address. */
  requestPasswordReset: async (email: string): Promise<{ kind: 'sent' } | { kind: 'error'; message: string }> => {
    const body = (await post('/api/auth/password-reset/request', { email: email.trim() })).data ?? {};
    if (body.error) return { kind: 'error', message: body.error };
    return body.success ? { kind: 'sent' } : { kind: 'error', message: UNEXPECTED };
  },

  resetPassword: async (email: string, otp: string, password: string): Promise<{ kind: 'done'; message: string } | { kind: 'error'; message: string }> => {
    const body = (await post('/api/auth/password-reset/confirm', { email: email.trim(), otp: otp.trim(), password })).data ?? {};
    if (body.error) return { kind: 'error', message: body.error };
    return typeof body.success === 'string' ? { kind: 'done', message: body.success } : { kind: 'error', message: UNEXPECTED };
  },

  /** The session behind the current token, or null when it is missing, expired or invalid. */
  session: async (signal?: AbortSignal) =>
    (await request<{ session: { user: SessionUser } | null }>('GET', '/api/auth/session', { signal })).data.session?.user ?? null,

  profile: async (signal?: AbortSignal) => (await request<Profile>('GET', '/api/users/me', { signal })).data,
};
