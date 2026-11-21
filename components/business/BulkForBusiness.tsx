'use client';

// Fonzkart for business (/bulk): we buy companies' surplus IT assets and e-waste in bulk, working or scrap, so their
// liquidation managers turn idle stock into cash. Made to be looked at more than read: an animated assets → pickup →
// cash flow, who it is for, what we buy, what every deal includes and four steps, with WhatsApp, call and email
// actions carrying a ready-made enquiry. The Customer app's Bulk screen (mobile/apps/customer/app/bulk.tsx) matches it.
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    ArrowRight, Banknote, Briefcase, Building2, CheckCircle2, GraduationCap, Headphones, Laptop, Lock, Mail, MessageCircle,
    Monitor, Package, Phone, Recycle, Rocket, Server, Smartphone, Tablet, Truck, Tv, Users, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const CONTACT = { phoneDisplay: '+91 90603 36060', phone: '+919060336060', whatsapp: '919060336060', email: 'connect@fonzkart.in', hours: 'Mon–Sat, 10am – 7pm' };
const MESSAGE = 'Hi Fonzkart, we have surplus IT assets / e-waste to liquidate. Device types and rough quantity: ____. Location: ____. Please share a quote.';
const whatsapp = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(MESSAGE)}`;
const mail = `mailto:${CONTACT.email}?subject=${encodeURIComponent('Bulk IT asset liquidation')}&body=${encodeURIComponent(MESSAGE)}`;

const FOR_WHOM: { icon: LucideIcon; label: string }[] = [
    { icon: Banknote, label: 'Liquidation managers' },
    { icon: Laptop, label: 'IT & admin teams' },
    { icon: Briefcase, label: 'Procurement' },
    { icon: Building2, label: 'Offices moving out' },
    { icon: GraduationCap, label: 'Schools & colleges' },
    { icon: Rocket, label: 'Startups' },
    { icon: Users, label: 'Dealers & resellers' },
];

const WE_BUY: { icon: LucideIcon; label: string }[] = [
    { icon: Laptop, label: 'Laptops' },
    { icon: Monitor, label: 'Desktops' },
    { icon: Smartphone, label: 'Phones' },
    { icon: Tablet, label: 'Tablets' },
    { icon: Tv, label: 'Monitors & TVs' },
    { icon: Server, label: 'Servers & networking' },
    { icon: Headphones, label: 'Accessories' },
    { icon: Recycle, label: 'E-waste & scrap' },
];

const INCLUDED: { icon: LucideIcon; title: string; note: string }[] = [
    { icon: Truck, title: 'Free pickup', note: 'From your premises' },
    { icon: Lock, title: 'Data wiped', note: 'Every single device' },
    { icon: Wallet, title: 'Fast payment', note: 'Straight to your account' },
    { icon: Recycle, title: 'Responsible recycling', note: 'Nothing goes to landfill' },
];

const STEPS: { icon: LucideIcon; title: string }[] = [
    { icon: Mail, title: 'Share your list' },
    { icon: Banknote, title: 'Get your quote' },
    { icon: Truck, title: 'We collect' },
    { icon: Wallet, title: 'You get paid' },
];

const rise = (i = 0) => ({
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { delay: i * 0.06, duration: 0.45, ease: 'easeOut' as const },
});

export function BulkForBusiness() {
    return (
        <div className="overflow-x-hidden">
            {/* Hero */}
            <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0b2316_0%,#14532d_55%,#16a34a_100%)] text-white">
                <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-lime-300/10 blur-3xl" />
                <div className="container relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-24">
                    <motion.div {...rise()}>
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-black tracking-[0.2em]">
                            <Building2 className="h-4 w-4" /> FOR BUSINESSES
                        </span>
                        <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
                            Turn idle IT assets into <span className="text-lime-300">cash</span>
                        </h1>
                        <p className="mt-4 text-lg font-semibold text-emerald-100">Working or scrap, any quantity. We buy it all.</p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <a href={whatsapp} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 font-black text-emerald-800 shadow-xl shadow-black/20 transition hover:-translate-y-0.5">
                                <MessageCircle className="h-5 w-5" /> Get a quote <ArrowRight className="h-4 w-4" />
                            </a>
                            <a href={`tel:${CONTACT.phone}`}
                                className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3.5 font-bold transition hover:bg-white/10">
                                <Phone className="h-5 w-5" /> {CONTACT.phoneDisplay}
                            </a>
                        </div>
                    </motion.div>
                    <motion.div {...rise(2)}><Flow /></motion.div>
                </div>
            </section>

            <div className="container mx-auto max-w-6xl space-y-20 px-4 py-16 md:py-20">
                {/* Built for */}
                <section>
                    <SectionTitle kicker="Who we work with" title="Built for" />
                    <div className="flex flex-wrap justify-center gap-3">
                        {FOR_WHOM.map((f, i) => (
                            <motion.span key={f.label} {...rise(i)}
                                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 font-bold text-emerald-950 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                                <f.icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> {f.label}
                            </motion.span>
                        ))}
                    </div>
                </section>

                {/* What we buy */}
                <section>
                    <SectionTitle kicker="Any brand, any condition" title="What we buy" />
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {WE_BUY.map((w, i) => (
                            <motion.div key={w.label} {...rise(i)} whileHover={{ y: -6 }}
                                className="group flex flex-col items-center gap-3 rounded-[1.75rem] border bg-card p-6 text-center shadow-sm transition-shadow hover:shadow-xl">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition-transform group-hover:rotate-6">
                                    <w.icon className="h-8 w-8" />
                                </div>
                                <span className="font-bold">{w.label}</span>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Working and scrap */}
                <section className="grid gap-4 md:grid-cols-2">
                    <motion.div {...rise()} className="relative overflow-hidden rounded-[2rem] bg-emerald-600 p-8 text-white">
                        <CheckCircle2 className="h-10 w-10" />
                        <h3 className="mt-4 text-3xl font-black">Working</h3>
                        <p className="mt-1 font-semibold text-emerald-100">Top resale value</p>
                        <Laptop className="absolute -bottom-6 -right-4 h-40 w-40 opacity-15" />
                    </motion.div>
                    <motion.div {...rise(1)} className="relative overflow-hidden rounded-[2rem] bg-amber-700 p-8 text-white">
                        <Recycle className="h-10 w-10" />
                        <h3 className="mt-4 text-3xl font-black">Dead or scrap</h3>
                        <p className="mt-1 font-semibold text-amber-100">Recycled, still paid</p>
                        <Package className="absolute -bottom-6 -right-4 h-40 w-40 opacity-15" />
                    </motion.div>
                </section>

                {/* Included */}
                <section>
                    <SectionTitle kicker="No hidden costs" title="Every deal includes" />
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {INCLUDED.map((x, i) => (
                            <motion.div key={x.title} {...rise(i)} className="rounded-[1.75rem] border bg-card p-6 shadow-sm">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                                    <x.icon className="h-6 w-6" />
                                </div>
                                <h3 className="mt-4 text-lg font-black">{x.title}</h3>
                                <p className="text-sm text-muted-foreground">{x.note}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Steps */}
                <section>
                    <SectionTitle kicker="Simple from start to finish" title="How it works" />
                    <div className="relative grid gap-8 md:grid-cols-4">
                        <div className="absolute left-[12.5%] right-[12.5%] top-8 hidden h-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 md:block" />
                        <motion.div className="absolute left-[12.5%] top-8 hidden h-1 rounded-full bg-emerald-500 md:block"
                            initial={{ width: 0 }} whileInView={{ width: '75%' }} viewport={{ once: true }} transition={{ duration: 1.4, ease: 'easeInOut' }} />
                        {STEPS.map((s, i) => (
                            <motion.div key={s.title} {...rise(i + 1)} className="relative flex flex-col items-center gap-3 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-8 ring-background">
                                    <s.icon className="h-7 w-7" />
                                </div>
                                <span className="text-xs font-black tracking-[0.2em] text-emerald-600">STEP {i + 1}</span>
                                <span className="text-lg font-black">{s.title}</span>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Call to action */}
                <motion.section {...rise()}
                    className="relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#0b2316_0%,#15803d_100%)] p-8 text-white md:p-14">
                    <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-lime-300/15 blur-3xl" />
                    <div className="relative grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
                        <div>
                            <h2 className="text-3xl font-black md:text-5xl">Talk to our business team</h2>
                            <p className="mt-2 font-semibold text-emerald-100">{CONTACT.hours}</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <a href={whatsapp} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-4 font-black text-emerald-800 transition hover:-translate-y-0.5">
                                <MessageCircle className="h-5 w-5" /> WhatsApp us
                            </a>
                            <a href={`tel:${CONTACT.phone}`} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-6 py-4 font-bold hover:bg-white/10">
                                <Phone className="h-5 w-5" /> Call {CONTACT.phoneDisplay}
                            </a>
                            <a href={mail} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-6 py-4 font-bold hover:bg-white/10">
                                <Mail className="h-5 w-5" /> {CONTACT.email}
                            </a>
                            <Link href="/contact?topic=bulk" className="text-center text-sm font-semibold text-emerald-100 underline-offset-4 hover:underline">
                                Or send us the form
                            </Link>
                        </div>
                    </div>
                </motion.section>
            </div>
        </div>
    );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
    return (
        <motion.div {...rise()} className="mb-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400">{kicker}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">{title}</h2>
        </motion.div>
    );
}

/** Your assets → our pickup → your cash: devices pile into a carton, a parcel rides the line, a note pops out. */
function Flow() {
    const devices = [Laptop, Smartphone, Monitor, Tablet];
    return (
        <div className="relative mx-auto aspect-[4/3] w-full max-w-lg rounded-[2rem] border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
            {/* Devices raining into the carton */}
            <div className="absolute left-[8%] top-[10%] h-[45%] w-[30%]">
                {devices.map((D, i) => (
                    <motion.div key={i} className="absolute left-1/2 -translate-x-1/2"
                        initial={{ y: -10, opacity: 0 }} animate={{ y: [-10, 70, 70], opacity: [0, 1, 0] }}
                        transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.6, times: [0, 0.6, 1] }}>
                        <D className="h-8 w-8 text-lime-200" />
                    </motion.div>
                ))}
            </div>
            <Node className="left-[6%] top-[52%]" icon={Package} label="Your assets" tone="bg-amber-500" />
            <Node className="left-[38%] top-[52%]" icon={Truck} label="Our pickup" tone="bg-emerald-500" />
            <Node className="left-[70%] top-[52%]" icon={Banknote} label="Your cash" tone="bg-lime-400 text-emerald-950" />
            {/* The line and the parcel riding it */}
            <div className="absolute left-[18%] right-[18%] top-[62%] h-1 rounded-full bg-white/25" />
            <motion.div className="absolute top-[calc(62%-10px)] h-6 w-6 rounded-md border-2 border-amber-100 bg-amber-500 shadow-lg"
                initial={{ left: '18%' }} animate={{ left: ['18%', '78%'], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', times: [0, 0.1, 0.9, 1] }} />
            {/* Cash popping out */}
            <motion.div className="absolute right-[10%] top-[18%] rounded-2xl bg-white px-4 py-2 font-black text-emerald-700 shadow-xl"
                animate={{ y: [8, -4, 8], rotate: [-4, 3, -4] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                ₹ Paid
            </motion.div>
            <div className="absolute bottom-5 left-6 right-6 flex justify-between text-[11px] font-black uppercase tracking-[0.18em] text-emerald-100/80">
                <span>Working</span><span>·</span><span>Scrap</span><span>·</span><span>Any quantity</span>
            </div>
        </div>
    );
}

function Node({ className, icon: Icon, label, tone }: { className: string; icon: LucideIcon; label: string; tone: string }) {
    return (
        <div className={`absolute flex w-[24%] flex-col items-center gap-2 ${className}`}>
            <motion.div whileHover={{ scale: 1.1 }} className={`flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-xl ${tone}`}>
                <Icon className="h-8 w-8" />
            </motion.div>
            <span className="text-center text-xs font-black md:text-sm">{label}</span>
        </div>
    );
}
