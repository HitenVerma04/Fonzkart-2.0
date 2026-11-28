'use client';

// What the page transition (NavTransition) listens to besides link clicks: buttons that navigate with router.push
// (useFlyRouter), and pages still loading (NavPending, in app/loading.tsx), which keep the cart up until they are ready.
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

type Listener = () => void;

let pending = 0;
const pendingListeners = new Set<Listener>();

export const pendingCount = () => pending;

export function onPending(listener: Listener) {
    pendingListeners.add(listener);
    return () => {
        pendingListeners.delete(listener);
    };
}

/** Rendered by a loading screen: while it is mounted the page is not ready yet. */
export function NavPending() {
    useEffect(() => {
        pending++;
        pendingListeners.forEach(l => l());
        return () => {
            pending--;
            pendingListeners.forEach(l => l());
        };
    }, []);
    return null;
}

let navListener: ((href: string) => void) | null = null;

export function setNavListener(listener: (href: string) => void) {
    navListener = listener;
    return () => {
        if (navListener === listener) navListener = null;
    };
}

/** Tells the transition a navigation is starting to `href` (it takes the icon from what was just pressed). */
export function announceNav(href: string) {
    navListener?.(href);
}

/** useRouter whose push plays the page transition, for buttons that navigate in code. */
export function useFlyRouter() {
    const router = useRouter();
    return useMemo(
        () => ({
            ...router,
            push: (href: string, options?: Parameters<typeof router.push>[1]) => {
                announceNav(href);
                router.push(href, options);
            },
        }),
        [router],
    );
}
