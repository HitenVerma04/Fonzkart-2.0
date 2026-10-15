'use server';

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/session';
import { EXECUTIVE_COOKIE, verifyExecutiveToken } from '@/lib/executive-session';
import { backendRequest, usesApi } from '@/lib/backend';

// Images from the admin panel (brand logos, model pictures) and from executives (pickup photos). Same rules as the
// backend's POST /api/uploads: a signed-in person or executive, images only (checked by their first bytes), 10 MB.
// With USE_API_UPLOADS=1 the file goes to the backend, which keeps it on its upload volume where the apps see it too;
// the website then serves /uploads/<name> from there (app/uploads/[name]/route.ts).

const MAX_BYTES = 10 * 1024 * 1024;

/** The image type from the file's first bytes, or null for anything that is not an accepted image. */
function imageExtension(b: Buffer): string | null {
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
    if (b.length >= 8 && b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG') return 'png';
    if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
    if (b.length >= 6 && b.toString('latin1', 0, 4) === 'GIF8') return 'gif';
    if (b.length >= 12 && b.toString('latin1', 4, 8) === 'ftyp'
        && ['heic', 'heix', 'mif1', 'msf1'].includes(b.toString('latin1', 8, 12).toLowerCase())) return 'heic';
    return null;
}

async function signedIn() {
    if ((await getSession())?.user) return true;
    return !!(await verifyExecutiveToken((await cookies()).get(EXECUTIVE_COOKIE)?.value));
}

export async function uploadImage(formData: FormData) {
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
        throw new Error('No file uploaded');
    }

    if (usesApi('UPLOADS')) {
        const form = new FormData();
        form.append('file', file, file.name || 'image');
        const { data } = await backendRequest<{ url: string }>('POST', '/api/uploads', { form });
        return data!.url;
    }

    if (!(await signedIn())) throw new Error('Unauthorized');
    if (file.size > MAX_BYTES) throw new Error('File too large (max 10 MB)');
    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = imageExtension(buffer);
    if (!extension) throw new Error('Only images can be uploaded');

    // Create unique filename to prevent overwrites; the extension comes from the content, not the name sent.
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const original = (file.name || '').replace(/[^a-zA-Z0-9.-]/g, '');
    const base = (original.includes('.') ? original.slice(0, original.lastIndexOf('.')) : original).replace(/\./g, '').slice(0, 60) || 'image';
    const filename = `${uniqueSuffix}-${base}.${extension}`;

    const uploadDir = join(process.cwd(), 'public', 'uploads');

    // Ensure directory exists
    try {
        await mkdir(uploadDir, { recursive: true });
    } catch (e) {
        console.error("Failed to make uploads dir:", e);
    }

    const path = join(uploadDir, filename);
    await writeFile(path, buffer);

    return `/uploads/${filename}`;
}
