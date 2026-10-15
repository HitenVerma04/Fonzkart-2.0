import { fetchBrands } from '@/actions/catalog';
import { HomeClient } from '@/components/HomeClient';
import { prisma } from '@/lib/db';
import { backendGet, usesApi } from '@/lib/backend';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Disable caching to ensure fresh data since it's now dynamic


export default async function Home() {
    try {
        // Fetch critical data on the server with caching
        const brands = await fetchBrands('smartphone');

        // Fetch active cities mapped simply as string names, ordered by feature status and custom order
        const citiesObj = await prisma.city.findMany({
            where: { isActive: true },
            select: { name: true },
            orderBy: [
                { isFeatured: 'desc' },
                { displayOrder: 'asc' },
                { name: 'asc' }
            ]
        });
        const activeCities = citiesObj.map(c => c.name);

        // Fetch display prices for the hero animation (with USE_API_CONTENT=1 from the backend, as the apps)
        const displayPrices = usesApi('CONTENT')
            ? (await backendGet<any[]>('/api/content/banner-prices')) ?? []
            : await (await import('@/lib/banner-prices')).fetchAllBannerPrices();

        return <HomeClient initialBrands={brands} activeCities={activeCities} displayPrices={displayPrices} />;
    } catch (error: any) {
        // The details go to the server log only: error messages and stacks can name servers, files and queries.
        console.error('Home page failed:', error);
        return (
            <div className="flex min-h-screen items-center justify-center p-6 text-red-500 bg-black">
                <div className="max-w-2xl bg-slate-900 p-8 rounded-lg border border-red-900">
                    <h1 className="text-2xl font-bold mb-4">Server Error</h1>
                    <p className="text-sm text-slate-300">Something went wrong on our side. Please try again in a moment.</p>
                </div>
            </div>
        );
    }
}
