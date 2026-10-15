import { useRouter, type Href } from 'expo-router';
import { useSession, type AuthOutcome } from '@fonzkart/api';

/**
 * What every sign-in style screen does with the server's answer: store the token and return to where the person
 * started (returnTo), or continue to email verification. Returns the error message to show, if any.
 */
export function useAuthOutcome(returnTo: string | undefined) {
  const router = useRouter();
  const { signIn } = useSession();
  return async (outcome: AuthOutcome): Promise<string | null> => {
    if (outcome.kind === 'error') return outcome.message;
    if (outcome.kind === 'verifyEmail') {
      router.push({ pathname: '/account/verify', params: { email: outcome.email, returnTo: returnTo ?? '' } });
      return null;
    }
    await signIn(outcome.token);
    router.dismissTo((returnTo || '/account') as Href);
    return null;
  };
}

/** A readable message for a request that failed before the server could answer. */
export function networkMessage(error: unknown): string {
  return error instanceof Error && error.message && !/network|fetch/i.test(error.message)
    ? error.message
    : 'Could not reach Fonzkart. Check your internet connection.';
}
