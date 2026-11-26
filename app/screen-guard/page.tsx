import { ScreenGuardSoon } from '@/components/shop/ScreenGuardSoon';
import { fetchStore } from '@/lib/shop-server';

export const metadata = {
    title: 'Doorstep Screen Guard Fitting (Coming Soon) - Fonzkart',
    description: 'Tempered glass, Gorilla Glass 5 unbreakable, matte and privacy screen guards for your exact phone, fitted at your door by a Fonzkart technician. Coming soon.',
};

// Screen guards are a doorstep service, coming soon. The page lists the kinds of guard for each phone ("Check your
// phone"); the store (ScreenGuardStore) returns here at launch.
export default async function ScreenGuardPage() {
    // The page never fails over the list: without it, "Check your phone" is simply left out.
    const store = process.env.BACKEND_URL ? await fetchStore().catch(() => null) : null;
    return <ScreenGuardSoon store={store} />;
}
