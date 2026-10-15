
'use server';

import { db } from '@/lib/store';
import { login } from '@/lib/session';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { backendAction, usesApi } from '@/lib/backend';
import * as attempts from '@/lib/attempt-limits';

// With USE_API_AUTH=1 these are done by the backend (as the apps), which sets the session cookie.
const fields = (formData: FormData, ...names: string[]) => Object.fromEntries(names.map(n => [n, formData.get(n)]));

export async function quickRegister(formData: FormData) {
    if (usesApi('AUTH')) return backendAction('/api/auth/quick-register', fields(formData, 'name', 'email', 'phone', 'password'));
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string; // Optional in schema but we want to save it
    const password = formData.get('password') as string;

    if (!email || !password || !name) {
        return { error: 'Please fill name, email and password' };
    }

    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
        return { error: 'Email already registered. Please sign in instead.' };
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
        id,
        email,
        passwordHash,
        name,
        phone: phone || null,
        role: 'USER'
    };

    if (phone) {
        const existingPhoneUser = await prisma.user.findUnique({ where: { phone } });
        if (existingPhoneUser) {
            return { error: 'Phone number already registered' };
        }
    }

    try {
        await db.addUser(newUser);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return { error: 'Phone number or email already registered' };
        }
        return { error: 'An error occurred during registration' };
    }

    // Create session
    await login({ id, email, name, role: 'USER' });

    return { success: true, user: { id, email, name, role: 'USER', phone } };
}

export async function quickLogin(formData: FormData) {
    if (usesApi('AUTH')) return backendAction('/api/auth/quick-login', fields(formData, 'email', 'password'));
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { error: 'Please fill email and password' };
    }

    const user = await db.findUserByEmail(email);
    // Guessing limit per account, shared with the sign-in page (lib/attempt-limits.ts).
    const account = user?.id ?? email;
    if (attempts.blocked('SIGNIN', account)) {
        return { error: attempts.TOO_MANY_SIGNINS };
    }
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        attempts.failed('SIGNIN', account);
        return { error: 'Invalid email or password' };
    }
    attempts.reset('SIGNIN', account);

    await login({ id: user.id, email: user.email, name: user.name, role: user.role });

    return { success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone } };
}
