import { fetchFestiveTheme } from '@/lib/shop-server';

export const dynamic = 'force-dynamic';

/** The festive theme, for the browser; the page's head script keeps the last answer, so a theme shows without a flash. */
export async function GET() {
    return Response.json({ theme: await fetchFestiveTheme() }, { headers: { 'Cache-Control': 'public, max-age=30' } });
}
