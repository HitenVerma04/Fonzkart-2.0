import { redirect } from 'next/navigation';
import { fetchPincodeRequests } from '@/actions/buyRepair';
import { PincodeRequestsAdmin } from '@/components/admin/PincodeRequestsAdmin';
import { CITY_STAFF, hasStaffRole } from '@/lib/staff-access';

export const dynamic = 'force-dynamic';

export default async function PincodeRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
    if (!(await hasStaffRole(CITY_STAFF))) redirect('/admin');
    const tab = (await searchParams).status === 'decided' ? 'decided' : 'pending';
    const [pending, decided] = await Promise.all([fetchPincodeRequests('pending'), tab === 'decided' ? fetchPincodeRequests('decided') : Promise.resolve(null)]);
    const requests = tab === 'pending' ? pending : decided;
    return (
        <div className="mx-auto max-w-4xl space-y-6 pb-20">
            <h1 className="text-3xl font-black">Pincode requests</h1>
            {requests ? <PincodeRequestsAdmin tab={tab} requests={requests} pendingCount={pending?.length ?? 0} />
                : <p className="text-muted-foreground">Pincode requests could not be loaded. Please try again.</p>}
        </div>
    );
}
