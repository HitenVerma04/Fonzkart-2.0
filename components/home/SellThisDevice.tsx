'use client';

// "Sell this device", as in the Customer app, for people on a phone or tablet. A browser tells less than the app can:
// Chrome on Android gives the model code, which the app's table turns into the exact model; an iPhone only says it is an
// iPhone; anything else stays "this phone". The card opens the sell flow as far along as what is known allows.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Smartphone, Tablet } from 'lucide-react';
import { identifyDevice, type DeviceMatch } from '@/actions/shop';
import type { Brand } from '@/lib/store';

type Found = { title: string; href: string; tablet: boolean; match: DeviceMatch | null };

type HighEntropy = { userAgentData?: { getHighEntropyValues(hints: string[]): Promise<{ model?: string }> } };

/** The Android model code: from the browser's client hints, or the older user agent where it still appears. */
async function androidCode(): Promise<string> {
    try {
        const hints = await (navigator as Navigator & HighEntropy).userAgentData?.getHighEntropyValues(['model']);
        if (hints?.model) return hints.model;
    } catch { /* fall back to the user agent */ }
    const code = navigator.userAgent.match(/Android [\d.]+;\s*(?:[a-z]{2}-[a-z]{2};\s*)?([^;)]+?)(?:\s+Build|\))/)?.[1] ?? '';
    return code === 'K' ? '' : code; // "K" is what a reduced user agent says instead
}

async function detect(brands: Brand[]): Promise<Found | null> {
    const ua = navigator.userAgent;
    const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (ipad || /iPhone/.test(ua)) {
        const apple = brands.find(b => b.name.toLowerCase() === 'apple');
        const category = ipad ? 'tablet' : 'smartphone';
        return { title: ipad ? 'your iPad' : 'your iPhone', href: `/sell?category=${category}${apple ? `&brandId=${apple.id}` : ''}`, tablet: ipad, match: null };
    }
    if (!/Android/.test(ua)) return null;
    const tablet = !/Mobile/.test(ua);
    const category = tablet ? 'tablet' : 'smartphone';
    const code = await androidCode();
    const match = code ? await identifyDevice(code).catch(() => null) : null;
    if (match) return { title: match.name, href: `/sell?category=${category}&brandId=${match.brandId}&modelId=${match.modelId}`, tablet, match };
    return { title: tablet ? 'this tablet' : 'this phone', href: `/sell?category=${category}`, tablet, match: null };
}

export function SellThisDevice({ brands }: { brands: Brand[] }) {
    const [found, setFound] = useState<Found | null>(null);

    useEffect(() => {
        let live = true;
        void detect(brands).then(result => {
            if (live) setFound(result);
        });
        return () => {
            live = false;
        };
    }, [brands]);

    if (!found) return null;
    const { title, href, tablet, match } = found;
    const Icon = tablet ? Tablet : Smartphone;
    return (
        <Link href={href} className="relative mt-6 flex items-center gap-3 overflow-hidden rounded-3xl p-4 text-left text-white active:scale-[0.98] transition-transform" style={{ background: 'var(--deep)' }}>
            <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--deep-accent)' }}>
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: 'var(--deep-accent)' }} />
                        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--deep-accent)' }} />
                    </span>
                    You&apos;re holding
                </p>
                <p className="mt-1 text-xl font-black leading-6">Sell {title}</p>
                {match?.best ? (
                    <p className="mt-2 text-sm text-white/70">Get up to <span className="text-xl font-black" style={{ color: 'var(--deep-accent)' }}>₹{match.best.toLocaleString('en-IN')}</span></p>
                ) : (
                    <p className="mt-2 text-sm text-white/70">See what it is worth in 60 seconds</p>
                )}
                <span className="mt-3 inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-bold text-[#0f3a24]" style={{ background: 'var(--deep-accent)' }}>
                    Sell now <ChevronRight className="h-4 w-4" />
                </span>
            </div>
            <div className="relative flex h-32 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
                {match?.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={match.img} alt={match.name} className="max-h-full max-w-full object-contain p-1" />
                ) : <Icon className="h-14 w-14 text-green-600" />}
                <span className="guard-glint absolute -top-[20%] h-[140%] w-[30%] bg-white/40" />
            </div>
        </Link>
    );
}
