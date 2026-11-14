import { redirect } from 'next/navigation';
import { fetchRepairAdmin } from '@/actions/buyRepair';
import { RepairAdmin } from '@/components/admin/RepairAdmin';
import { ADMINS, hasStaffRole } from '@/lib/staff-access';

export const dynamic = 'force-dynamic';

export default async function RepairAdminPage() {
    if (!(await hasStaffRole(ADMINS))) redirect('/admin');
    const data = await fetchRepairAdmin();
    return (
        <div className="mx-auto max-w-5xl space-y-6 pb-20">
            <h1 className="text-3xl font-black">Repairs</h1>
            {data ? <RepairAdmin enabled={data.list.enabled} items={data.list.items} bookings={data.bookings} />
                : <p className="text-muted-foreground">Repair prices could not be loaded. Please try again.</p>}
        </div>
    );
}
