import { redirect } from 'next/navigation';
import { fetchShopAdmin } from '@/actions/shop';
import { ShopAdmin } from '@/components/admin/ShopAdmin';
import { ADMINS, hasStaffRole } from '@/lib/staff-access';

export const dynamic = 'force-dynamic';

export default async function ShopAdminPage() {
    if (!(await hasStaffRole(ADMINS))) redirect('/admin');
    const shop = await fetchShopAdmin();
    return (
        <div className="mx-auto max-w-5xl space-y-6 pb-20">
            <h1 className="text-3xl font-black">Screen guard store</h1>
            {shop ? <ShopAdmin settings={shop.settings} items={shop.items} orders={shop.orders} /> : <p className="text-muted-foreground">The store could not be loaded. Please try again.</p>}
        </div>
    );
}
