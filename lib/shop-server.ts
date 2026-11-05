// Reads from the Spring Boot backend (ShopController), which the website shares with the apps.
import { backendGet } from './backend';
import type { ScreenGuardStore } from './shop';

export async function fetchStore(): Promise<ScreenGuardStore | null> {
    return backendGet<ScreenGuardStore>('/api/shop/screen-guards');
}

/** The festive theme chosen by an administrator; a page never fails over a missing theme. */
export async function fetchFestiveTheme(): Promise<string> {
    if (!process.env.BACKEND_URL) return 'none';
    try {
        const res = await fetch(new URL('/api/app/theme', process.env.BACKEND_URL), { next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) });
        if (!res.ok) return 'none';
        return ((await res.json()) as { theme?: string }).theme ?? 'none';
    } catch {
        return 'none';
    }
}
