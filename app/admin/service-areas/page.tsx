import { redirect } from 'next/navigation';
import { fetchMyPincodes } from '@/actions/buyRepair';
import { ServiceAreas } from '@/components/admin/ServiceAreas';
import { hasStaffRole } from '@/lib/staff-access';

export const dynamic = 'force-dynamic';

export default async function ServiceAreasPage() {
    if (!(await hasStaffRole(['PARTNER']))) redirect('/admin');
    const data = await fetchMyPincodes();
    return (
        <div className="mx-auto max-w-4xl space-y-6 pb-20">
            <h1 className="text-3xl font-black">Service areas</h1>
            {data ? <ServiceAreas data={data} /> : <p className="text-muted-foreground">Your service areas could not be loaded. Please try again.</p>}
        </div>
    );
}
