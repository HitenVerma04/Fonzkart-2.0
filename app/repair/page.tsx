import Link from 'next/link';
import { fetchRepairPrices } from '@/actions/buyRepair';
import { RepairBooker } from '@/components/repair/RepairBooker';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Doorstep Phone Repair - Fonzkart',
    description: 'Fixed-price phone repairs at your home or office: screen, battery, charging port and more. Pay after the repair.',
};

export default async function RepairPage() {
    const [list, session] = await Promise.all([fetchRepairPrices(), getSession()]);
    const items = (list?.items ?? []).filter(i => i.isActive);
    if (!list?.enabled || !items.length) {
        return (
            <div className="mx-auto max-w-xl px-4 py-20 text-center">
                <h1 className="text-3xl font-black">Doorstep repairs are coming soon</h1>
                <p className="mt-2 text-muted-foreground">Fixed prices, repaired at your home or office. Check back soon.</p>
                <Link href="/sell" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Sell a device</Link>
            </div>
        );
    }
    return <RepairBooker items={items} signedIn={!!session} defaultName={session?.user?.name ?? ''} />;
}
