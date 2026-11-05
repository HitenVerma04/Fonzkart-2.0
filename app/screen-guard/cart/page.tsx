import { redirect } from 'next/navigation';
import { CartCheckout } from '@/components/shop/CartCheckout';
import { getSession } from '@/lib/session';
import { fetchStore } from '@/lib/shop-server';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Your Cart - Fonzkart' };

export default async function ScreenGuardCartPage() {
    const [store, session] = await Promise.all([fetchStore().catch(() => null), getSession()]);
    if (!store?.storeEnabled) redirect('/screen-guard');
    return <CartCheckout store={store} signedIn={!!session} defaultName={session?.user?.name ?? ''} />;
}
