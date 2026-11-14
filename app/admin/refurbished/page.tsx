import { redirect } from 'next/navigation';
import { fetchBuyAdmin } from '@/actions/buyRepair';
import { RefurbishedAdmin } from '@/components/admin/RefurbishedAdmin';
import { ADMINS, hasStaffRole } from '@/lib/staff-access';

export const dynamic = 'force-dynamic';

export default async function RefurbishedAdminPage() {
    if (!(await hasStaffRole(ADMINS))) redirect('/admin');
    const data = await fetchBuyAdmin();
    return (
        <div className="mx-auto max-w-5xl space-y-6 pb-20">
            <h1 className="text-3xl font-black">Refurbished devices</h1>
            {data ? <RefurbishedAdmin enabled={data.store.enabled} items={data.store.items} orders={data.orders} />
                : <p className="text-muted-foreground">Refurbished devices could not be loaded. Please try again.</p>}
        </div>
    );
}
