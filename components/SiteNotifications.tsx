'use client';

// Notifications on the public website for whoever is signed in (customers: their order updates; staff: their inbox):
// a bell with the unread count and the latest updates, and a banner when something new arrives while a page is open
// (NotificationToast). The inbox is checked every 30 seconds and when the tab comes back into view, as in the apps.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { getNotifications, markAllAsRead, markAsRead } from '@/actions/notifications';
import { NotificationToast, type ToastNotification } from './NotificationToast';

const REFRESH_MS = 30_000;

export function SiteNotifications({ isStaff }: { isStaff: boolean }) {
    const router = useRouter();
    const [items, setItems] = useState<ToastNotification[] | undefined>(undefined);
    const [open, setOpen] = useState(false);
    const panel = useRef<HTMLDivElement>(null);

    const load = useCallback(async () => {
        const res = await getNotifications().catch(() => null) as { success?: boolean; notifications?: ToastNotification[] } | null;
        if (res?.success && res.notifications) setItems(res.notifications);
    }, []);

    useEffect(() => {
        void load();
        const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
        const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
    }, [load]);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => { if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const openItem = (n: ToastNotification) => {
        setOpen(false);
        if (!n.isRead) {
            setItems(now => now?.map(x => (x.id === n.id ? { ...x, isRead: true } : x)));
            void markAsRead(n.id).catch(() => undefined);
        }
        router.push(isStaff ? (n.orderId ? '/admin/orders' : '/admin') : '/orders');
    };
    const unread = items?.filter(n => !n.isRead).length ?? 0;

    return (
        <>
            <div className="relative" ref={panel}>
                <button type="button" onClick={() => setOpen(o => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
                    className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    <Bell className="h-5 w-5" />
                    {unread > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-black text-white ring-2 ring-background">
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </button>
                {open && (
                    <div className="absolute right-0 top-11 z-[110] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border bg-card shadow-2xl">
                        <div className="flex items-center justify-between border-b px-4 py-3">
                            <span className="font-black">Notifications</span>
                            {unread > 0 && (
                                <button type="button" className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                                    onClick={() => { setItems(now => now?.map(x => ({ ...x, isRead: true }))); void markAllAsRead().catch(() => undefined); }}>
                                    <CheckCheck className="h-4 w-4" /> Mark all read
                                </button>
                            )}
                        </div>
                        <ul className="max-h-96 overflow-y-auto">
                            {items?.length ? items.slice(0, 15).map(n => (
                                <li key={n.id}>
                                    <button type="button" onClick={() => openItem(n)}
                                        className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-muted ${n.isRead ? '' : 'bg-emerald-50/70 dark:bg-emerald-500/10'}`}>
                                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-emerald-600'}`} />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-bold">{n.title}</span>
                                            <span className="line-clamp-2 block text-xs text-muted-foreground">{n.message}</span>
                                            <span className="mt-0.5 block text-[11px] text-muted-foreground">{new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                        </span>
                                    </button>
                                </li>
                            )) : <li className="px-4 py-8 text-center text-sm text-muted-foreground">No updates yet.</li>}
                        </ul>
                    </div>
                )}
            </div>
            <NotificationToast items={items} onOpen={openItem} />
        </>
    );
}
