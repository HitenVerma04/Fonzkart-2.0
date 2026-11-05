import Link from 'next/link';
import { ScreenGuardStore } from '@/components/shop/ScreenGuardStore';
import { fetchStore } from '@/lib/shop-server';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Screen Guards - Fonzkart',
    description: 'Tempered glass screen guards for your exact phone, delivered to your door. Cash on delivery.',
};

export default async function ScreenGuardPage() {
    const store = await fetchStore().catch(() => null);
    if (!store?.storeEnabled || !store.items.length) {
        return (
            <div className="mx-auto max-w-xl px-4 py-20 text-center">
                <h1 className="text-3xl font-black">Screen guards are coming soon</h1>
                <p className="mt-2 text-muted-foreground">Guards for your exact model, delivered to your door.</p>
                <Link href="/sell" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Sell a device</Link>
            </div>
        );
    }
    return <ScreenGuardStore store={store} />;
}
