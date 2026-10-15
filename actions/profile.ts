'use server';

import { db } from '@/lib/store';
import { getSession } from '@/lib/session';
import { backendRequest, usesApi } from '@/lib/backend';

export async function updateProfile(prevState: { error?: string, success?: boolean } | null, formData: FormData) {
    // With USE_API_AUTH=1 the backend updates the profile (as the apps); same answers: {success: true} or {error}.
    if (usesApi('AUTH')) {
        return (await backendRequest<{ success?: boolean; error?: string }>('PUT', '/api/users/me', { body: { name: formData.get('name'), phone: formData.get('phone') }, keepErrors: true })).data
            ?? { error: 'Failed to update profile' };
    }
    const session = await getSession();
    if (!session?.user) {
        return { error: 'Unauthorized' };
    }

    const name = formData.get('name') as string;
    let phone = formData.get('phone') as string;

    if (!name) {
        return { error: 'Name cannot be empty' };
    }

    if (phone && !phone.startsWith('+91')) {
        phone = `+91${phone}`;
    }

    try {
        await db.updateProfile(session.user.email, { name, phone });
        return { success: true };
    } catch (e: any) {
        return { error: 'Failed to update profile' };
    }
}
