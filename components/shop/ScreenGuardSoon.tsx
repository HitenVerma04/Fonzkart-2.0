'use client';

// Screen guards (/screen-guard): a doorstep service, coming soon. A technician brings the right guard for the
// customer's exact model and fits it at their door. Until launch this page shows the service and points to what works
// today. The store (ScreenGuardStore, CartCheckout) stays in the code for the launch. The Customer app's screen
// (mobile/apps/customer/app/screen-guard.tsx) matches it.
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Camera, CheckCircle2, Clock, EyeOff, Shield, ShieldCheck, Sparkles, Sun, Truck, Wallet, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const STEPS: { icon: LucideIcon; title: string }[] = [
    { icon: Clock, title: 'Book a slot' },
    { icon: Truck, title: 'We come to you' },
    { icon: ShieldCheck, title: 'Fitted on the spot' },
];

const GUARDS: { icon: LucideIcon; title: string; note: string }[] = [
    { icon: Shield, title: 'Tempered glass', note: 'Everyday armour' },
    { icon: EyeOff, title: 'Privacy', note: 'Side views blocked' },
    { icon: Sun, title: 'Matte', note: 'No glare, no prints' },
    { icon: Camera, title: 'Camera lens', note: 'Lens protected' },
];

const PROMISES: { icon: LucideIcon; text: string }[] = [
    { icon: CheckCircle2, text: 'Exact fit for your model' },
    { icon: Sparkles, text: 'Bubble-free fitting' },
    { icon: Wallet, text: 'Pay after fitting' },
];

const rise = (i = 0) => ({
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' as const },
});

export function ScreenGuardSoon() {
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
                                    <p.icon className="h-5 w-5 text-lime-300" /> {p.text}
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
                    <motion.h2 {...rise()} className="mb-6 text-center text-3xl font-black tracking-tight md:text-4xl">Guards we&apos;ll carry</motion.h2>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        {GUARDS.map((g, i) => (
                            <motion.div key={g.title} {...rise(i)} whileHover={{ y: -6 }} className="rounded-[1.75rem] border bg-card p-6 shadow-sm">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                                    <g.icon className="h-6 w-6" />
                                </div>
                                <h3 className="mt-4 font-black">{g.title}</h3>
                                <p className="text-sm text-muted-foreground">{g.note}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

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
            <motion.div className="absolute right-[2%] top-[10%] rounded-2xl bg-lime-300 px-4 py-2 font-black text-emerald-950 shadow-xl"
                animate={{ y: [6, -6, 6] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                Bubble-free ✓
            </motion.div>
        </div>
    );
}
