import Link from 'next/link';
import { fetchBuyStore } from '@/actions/buyRepair';
import { BuyStore } from '@/components/buy/BuyStore';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Buy Refurbished Phones - Fonzkart',
    description: 'Checked refurbished phones with a warranty, delivered to your door. Cash on delivery.',
};

export default async function BuyPage() {
    const [store, session] = await Promise.all([fetchBuyStore(), getSession()]);
    const items = (store?.items ?? []).filter(i => i.isActive && i.stock > 0);
    if (!store?.enabled || !items.length) {
        return (
            <div className="mx-auto max-w-xl px-4 py-20 text-center">
                <h1 className="text-3xl font-black">Refurbished phones are on their way</h1>
                <p className="mt-2 text-muted-foreground">Checked devices with a warranty, delivered to your door. Check back soon.</p>
                <Link href="/sell" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Sell a device</Link>
            </div>
        );
    }
    return <BuyStore items={items} signedIn={!!session} defaultName={session?.user?.name ?? ''} />;
}
