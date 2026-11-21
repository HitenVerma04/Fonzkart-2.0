'use client';

// In-app notifications on the website, as in the apps' InAppNotifier: when something new reaches the inbox while a page
// is open, a banner slides in at the top with its title and message. Clicking it opens what it is about; it hides
// itself after a few seconds, or with ✕. What was already in the inbox when the page opened is not announced again.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X } from 'lucide-react';

export type ToastNotification = { id: string; title: string; message: string; isRead: boolean; createdAt: string | Date; orderId?: string | null };

/** Watches `items` (the inbox, undefined until loaded) and announces new unread ones. */
export function NotificationToast({ items, onOpen }: { items: ToastNotification[] | undefined; onOpen: (n: ToastNotification) => void }) {
    const seen = useRef<Set<string> | null>(null);
    const [current, setCurrent] = useState<{ item: ToastNotification; more: number } | null>(null);

    useEffect(() => {
        if (!items) return;
        if (!seen.current) {
            seen.current = new Set(items.map(i => i.id));
            return;
        }
        const fresh = items.filter(i => !i.isRead && !seen.current!.has(i.id));
        items.forEach(i => seen.current!.add(i.id));
        if (!fresh.length) return;
        const newest = [...fresh].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        setCurrent({ item: newest, more: fresh.length - 1 });
    }, [items]);

    useEffect(() => {
        if (!current) return;
        const timer = setTimeout(() => setCurrent(null), 6000);
        return () => clearTimeout(timer);
    }, [current]);

    return (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[120] flex justify-center px-3">
            <AnimatePresence>
                {current && (
                    <motion.div key={current.item.id} role="status" aria-live="polite"
                        initial={{ y: -120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -120, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-emerald-200 border-l-[6px] border-l-emerald-600 bg-card p-4 shadow-2xl shadow-emerald-950/20 dark:border-emerald-500/30">
                        <button type="button" className="flex flex-1 items-start gap-3 text-left"
                            onClick={() => { const n = current.item; setCurrent(null); onOpen(n); }}>
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                                <Bell className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-black">{current.item.title}</span>
                                <span className="line-clamp-2 block text-sm text-muted-foreground">{current.item.message}</span>
                                {current.more > 0 && <span className="mt-0.5 block text-xs font-bold text-emerald-600">+{current.more} more</span>}
                            </span>
                        </button>
                        <button type="button" aria-label="Dismiss notification" onClick={() => setCurrent(null)} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
                            <X className="h-4 w-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
