'use server';

import { logout as endSession } from '@/lib/session';

// Signing out is the only session function the browser may call. lib/session.ts is server-only code: as a
// 'use server' module its encrypt() and login() would have been callable from the browser to sign any session.
export async function logout() {
    await endSession();
}
