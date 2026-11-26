'use client';

// Screen guards (/screen-guard): a doorstep service, coming soon. A technician brings the right guard for the
// customer's exact model and fits it at their door. Until launch this page shows the service and points to what works
// today. The store (ScreenGuardStore, CartCheckout) stays in the code for the launch. The Customer app's screen
// (mobile/apps/customer/app/screen-guard.tsx) matches it. Every phone gets four kinds of guard (tempered glass,
// Gorilla Glass 5 unbreakable, matte, privacy), and "Check your phone" lists them for the customer's model.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, CheckCircle2, Clock, EyeOff, Search, Shield, ShieldCheck, Smartphone, Sparkles, Sun, Truck, Wallet, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { guardKind, guardsByModel, type ScreenGuardStore } from '@/lib/shop';

const STEPS: { icon: LucideIcon; title: string }[] = [
    { icon: Clock, title: 'Book a slot' },
    { icon: Truck, title: 'We come to you' },
    { icon: ShieldCheck, title: 'Fitted on the spot' },
];

const KIND_ICON: Record<string, LucideIcon> = {
    tempered: Shield, unbreakable: ShieldCheck, matte: Sun, privacy: EyeOff, clear: Sparkles, full: Smartphone, lens: Camera,
};

/** The kinds every phone gets. */
const MAIN_KINDS = ['unbreakable', 'tempered', 'matte', 'privacy'];

const PROMISES: { icon: LucideIcon; text: string }[] = [
    { icon: Truck, text: 'Fitted at your doorstep' },
    { icon: ShieldCheck, text: 'Unbreakable Gorilla Glass 5 guards' },
    { icon: CheckCircle2, text: 'Exact fit for your model' },
    { icon: Sparkles, text: 'Bubble-free fitting' },
    { icon: Wallet, text: 'Pay after fitting' },
];

/** The badge floating over the phone, one promise at a time. */
const BADGES = ['Bubble-free ✓', 'At your doorstep ✓', 'Unbreakable ✓', 'Matte & privacy ✓'];
const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const rise = (i = 0) => ({
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' as const },
});

export function ScreenGuardSoon({ store }: { store: ScreenGuardStore | null }) {
    return (
        <div className="overflow-x-hidden">
            <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0b2316_0%,#14532d_55%,#16a34a_100%)] text-white">
                <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl" />
                <div className="container relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-24">
                    <motion.div {...rise()}>
                        <span className="inline-flex items-center gap-2 rounded-full bg-lime-300 px-4 py-1.5 text-xs font-black tracking-[0.2em] text-emerald-950">
                            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-700" /> COMING SOON
                        </span>
                        <p className="mt-6 text-xs font-black uppercase tracking-[0.25em] text-emerald-200">Doorstep service</p>
                        <h1 className="mt-2 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">Screen guards, fitted at your door</h1>
                        <ul className="mt-6 space-y-2">
                            {PROMISES.map(p => (
                                <li key={p.text} className="flex items-center gap-3 font-semibold">
                                    <p.icon className="h-5 w-5 shrink-0 text-lime-300" /> {p.text}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                    <motion.div {...rise(2)}><Visual /></motion.div>
                </div>
            </section>

            <div className="container mx-auto max-w-5xl space-y-16 px-4 py-16">
                <section className="relative grid grid-cols-3 gap-4">
                    <div className="absolute left-[16%] right-[16%] top-8 h-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20" />
                    {STEPS.map((s, i) => (
                        <motion.div key={s.title} {...rise(i)} className="relative flex flex-col items-center gap-2 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-8 ring-background">
                                <s.icon className="h-7 w-7" />
                            </div>
                            <span className="text-xs font-black tracking-[0.2em] text-emerald-600">{i + 1}</span>
                            <span className="font-black md:text-lg">{s.title}</span>
                        </motion.div>
                    ))}
                </section>

                <section>
                    <motion.h2 {...rise()} className="text-center text-3xl font-black tracking-tight md:text-4xl">Four kinds for every phone</motion.h2>
                    <motion.p {...rise(1)} className="mb-6 mt-2 text-center text-muted-foreground">Pick the one you like. We bring it for your exact model.</motion.p>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        {MAIN_KINDS.map(guardKind).map((k, i) => {
                            const KindIcon = KIND_ICON[k.id] ?? Shield;
                            const star = k.id === 'unbreakable';
                            return (
                                <motion.div key={k.id} {...rise(i)} whileHover={{ y: -6 }}
                                    className={`relative rounded-[1.75rem] border p-6 shadow-sm ${star ? 'border-emerald-700 bg-emerald-950 text-white' : 'bg-card'}`}>
                                    {star ? <span className="absolute right-4 top-4 rounded-full bg-lime-300 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-emerald-950">TOUGHEST</span> : null}
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${star ? 'bg-lime-300 text-emerald-950' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'}`}>
                                        <KindIcon className="h-6 w-6" />
                                    </div>
                                    <h3 className="mt-4 font-black">{k.title}</h3>
                                    <p className={`text-sm ${star ? 'text-emerald-100' : 'text-muted-foreground'}`}>{k.note}</p>
                                </motion.div>
                            );
                        })}
                    </div>
                </section>

                {store?.items.length ? <GuardFinder store={store} /> : null}

                <motion.section {...rise()} className="rounded-[2rem] border bg-emerald-50 p-8 text-center dark:bg-emerald-500/10">
                    <p className="font-bold text-muted-foreground">Launching soon. Meanwhile:</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                        <Link href="/sell" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-black text-primary-foreground">Sell a device</Link>
                        <Link href="/repair" className="inline-flex items-center gap-2 rounded-full border border-emerald-600 px-6 py-3 font-bold text-emerald-700 dark:text-emerald-400">
                            <Wrench className="h-4 w-4" /> Book a repair
                        </Link>
                    </div>
                </motion.section>
            </div>
        </div>
    );
}

/** "Check your phone": search a model and see every kind of guard made for it. */
function GuardFinder({ store }: { store: ScreenGuardStore }) {
    const models = useMemo(() => guardsByModel(store.items), [store.items]);
    const [query, setQuery] = useState('');
    const words = normal(query);
    const matches = words ? models.filter(m => normal(`${m.brand} ${m.model}`).includes(words)) : models;
    const shown = matches.slice(0, 6);
    return (
        <motion.section {...rise()} className="rounded-[2rem] border bg-card p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-black tracking-tight md:text-3xl">Check your phone</h2>
            <p className="mt-1 text-sm text-muted-foreground">{models.length} phones covered. Prices when we launch.</p>
            <label className="mt-4 flex items-center gap-2 rounded-full border bg-background px-4 py-3 focus-within:border-emerald-600">
                <Search className="h-4 w-4 shrink-0 text-emerald-600" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Type your phone, e.g. iPhone 16 Pro"
                    aria-label="Search your phone" className="w-full bg-transparent text-sm outline-none" />
            </label>
            {shown.length ? (
                <ul className="mt-4 grid gap-3 md:grid-cols-2">
                    {shown.map(m => (
                        <li key={`${m.brand}|${m.model}`} className="rounded-2xl border p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{m.brand}</p>
                            <p className="font-black">{m.model}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {m.guards.map(g => {
                                    const kind = guardKind(g.guardType);
                                    const KindIcon = KIND_ICON[kind.id] ?? Shield;
                                    const star = kind.id === 'unbreakable';
                                    return (
                                        <span key={g.id} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${star
                                            ? 'bg-emerald-950 text-lime-300 dark:bg-lime-300 dark:text-emerald-950'
                                            : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'}`}>
                                            <KindIcon className="h-3.5 w-3.5" /> {star ? 'Unbreakable · Gorilla Glass 5' : kind.title}
                                        </span>
                                    );
                                })}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-4 rounded-2xl bg-muted p-4 text-sm font-semibold">Not on the list yet. Tell us when we launch and we&apos;ll bring the right guard.</p>
            )}
            {matches.length > shown.length ? (
                <p className="mt-3 text-sm text-muted-foreground">{matches.length - shown.length} more phones. Type your model to find it.</p>
            ) : null}
        </motion.section>
    );
}

/** A phone with a guard sliding onto it, and the technician's van arriving. */
function Visual() {
    return (
        <div className="relative mx-auto aspect-square w-full max-w-md">
            <div className="absolute inset-0 rounded-full bg-white/10 blur-2xl" />
            {/* Phone */}
            <div className="absolute left-1/2 top-1/2 h-[70%] w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border-4 border-slate-900 bg-[linear-gradient(160deg,#134e4a,#0f766e_60%,#14b8a6)] shadow-2xl">
                <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-slate-900" />
                {/* The guard sliding down and settling */}
                <motion.div className="absolute inset-1 rounded-[1.6rem] border-2 border-white/70 bg-white/25"
                    animate={{ y: ['-120%', '0%', '0%', '0%'], opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.35, 0.85, 1], ease: 'easeOut' }} />
                {/* Shine sweeping over the fitted guard */}
                <motion.div className="absolute inset-y-2 w-6 -skew-x-12 bg-white/40"
                    animate={{ left: ['-20%', '120%'] }} transition={{ duration: 3.6, repeat: Infinity, delay: 1.3, ease: 'easeInOut' }} />
                <ShieldCheck className="absolute bottom-6 left-1/2 h-10 w-10 -translate-x-1/2 text-white/90" />
            </div>
            {/* Van */}
            <motion.div className="absolute bottom-[8%] flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 font-black text-emerald-700 shadow-xl"
                animate={{ left: ['-10%', '4%', '4%'] }} transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.3, 1], ease: 'easeOut' }}>
                <Truck className="h-5 w-5" /> At your door
            </motion.div>
            <motion.div className="absolute right-[2%] top-[10%] overflow-hidden rounded-2xl bg-lime-300 px-4 py-2 font-black text-emerald-950 shadow-xl"
                animate={{ y: [6, -6, 6] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                <RotatingBadge />
            </motion.div>
        </div>
    );
}

/** One promise at a time, sliding up every few seconds. */
function RotatingBadge() {
    const [index, setIndex] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setIndex(i => (i + 1) % BADGES.length), 2400);
        return () => clearInterval(timer);
    }, []);
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.span key={index} className="block whitespace-nowrap" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.25 }}>
                {BADGES[index]}
            </motion.span>
        </AnimatePresence>
    );
}
