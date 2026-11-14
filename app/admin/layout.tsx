
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { isAdmin } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';
import { LayoutDashboard, Smartphone, Layers, Tag, ExternalLink, Users, ShoppingCart } from 'lucide-react';

import AdminSidebar from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { NotificationProvider } from '@/components/NotificationProvider';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();
    if (!session || !session.user || !isAdmin(session.user)) {
        redirect('/');
    }

    return (
        <NotificationProvider userId={session.user.id} userRole={session.user.role}>
            <div className="admin-shell flex min-h-[100dvh] bg-muted/20 dark:bg-black flex-row">
                {/* Sidebar */}
                <AdminSidebar role={session.user.role} />

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                    <AdminHeader user={session.user} />
                    <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50 dark:bg-slate-950/20">
                        <div className="max-w-[1600px] mx-auto">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </NotificationProvider>
    );
}
