import { redirect } from 'next/navigation';
import { fetchCarouselAdmin } from '@/actions/buyRepair';
import { CarouselAdmin } from '@/components/admin/CarouselAdmin';
import { ADMINS, hasStaffRole } from '@/lib/staff-access';

export const dynamic = 'force-dynamic';

export default async function CarouselAdminPage() {
    if (!(await hasStaffRole(ADMINS))) redirect('/admin');
    const slides = await fetchCarouselAdmin();
    return (
        <div className="mx-auto max-w-5xl space-y-6 pb-20">
            <h1 className="text-3xl font-black">Edit carousel view</h1>
            {slides ? <CarouselAdmin slides={slides} /> : <p className="text-muted-foreground">The carousel could not be loaded. Please try again.</p>}
        </div>
    );
}
