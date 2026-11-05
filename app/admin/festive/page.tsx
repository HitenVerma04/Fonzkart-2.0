import { redirect } from 'next/navigation';
import { FestivePicker } from '@/components/admin/FestivePicker';
import { fetchFestiveTheme } from '@/lib/shop-server';
import { ADMINS, hasStaffRole } from '@/lib/staff-access';

export const dynamic = 'force-dynamic';

export default async function FestiveThemePage() {
    if (!(await hasStaffRole(ADMINS))) redirect('/admin');
    const theme = await fetchFestiveTheme();
    return (
        <div className="mx-auto max-w-2xl space-y-6 pb-20">
            <div>
                <h1 className="text-3xl font-black">Festive theme</h1>
                <p className="text-muted-foreground">Changes the website and the Customer app for everyone, within a minute.</p>
            </div>
            <FestivePicker current={theme} />
        </div>
    );
}
