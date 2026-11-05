'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Zap, ShieldCheck, CheckCircle, Star, Clock, MapPin, BadgePercent, Sparkles } from 'lucide-react';
import HowItWorks from '@/components/HowItWorks';
import HeroAnimation from '@/components/HeroAnimation';
import { ReviewsMarquee } from '@/components/ReviewsMarquee';
import CategorySelector from '@/components/sell/CategorySelector';
import { Logo } from '@/components/Logo';
import { HomeSearch } from '@/components/HomeSearch';
import { BrandRail } from '@/components/BrandRail';
import { DynamicLogo } from '@/components/DynamicLogo';
import { useRouter } from 'next/navigation';
import { PriceGraphic, SpeedGraphic, SecurityGraphic } from '@/components/icons/FeatureIcons';
import { Brand } from '@/lib/store';
import { FestiveBanner } from '@/components/festive/FestiveBanner';
import { FactoryBackground } from '@/components/home/FactoryBackground';
import { SellThisDevice } from '@/components/home/SellThisDevice';

export function HomeClient({ initialBrands, activeCities = [], displayPrices = [] }: { initialBrands: Brand[], activeCities?: string[], displayPrices?: any[] }) {
    const router = useRouter();

    const handleCategorySelect = (category: string) => {
        if (category === 'bulk-orders') {
            router.push('/contact?topic=bulk');
            return;
        }
        if (category === 'repair') {
            router.push('/repair');
            return;
        }
        if (category === 'unbreakable-screenguard') {
            router.push('/screen-guard');
            return;
        }
        router.push(`/sell?category=${category}`);
    };

    return (
        <div className="flex flex-col min-h-screen overflow-x-hidden">
            <FactoryBackground />
            <FestiveBanner />
            {/* Hero Section */}
            <section className="relative pt-0 pb-32 md:pt-40 md:pb-52 overflow-hidden w-full">
                {/* Background FX */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
                    <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-green-500/10 rounded-full blur-[120px] opacity-60" />
                    <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] opacity-40" />
                    <div className="absolute bottom-0 right-0 w-full h-px bg-gradient-to-r from-transparent via-green-500/20 to-transparent" />
                </div>

                <div className="container mx-auto px-6 md:px-12 xl:px-20 max-w-[100vw] overflow-x-hidden">
                    <div className="flex flex-col items-center gap-12 xl:gap-16">

                        {/* Content */}
                        <div className="flex-1 w-full max-w-3xl animate-in slide-in-from-bottom-8 fade-in-20 duration-700 flex flex-col items-center text-center z-20 mx-auto">

                            {/* REBUILT DESKTOP TOP SECTION: Logo + Badge */}

                            {/* Desktop Logo (Added per request) */}
                            <div className="hidden xl:flex mb-6 scale-[1.3] origin-center pt-2 overflow-visible">
                                <DynamicLogo />
                            </div>

                            {/* Trust Badge / Pill */}
                            <div className="hidden xl:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-slate-900 border border-green-500/40 shadow-sm mb-6 hover:shadow-md transition-all cursor-default w-fit text-white">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                </span>
                                <span className="text-xs font-semibold tracking-wide uppercase">INDIA&apos;S MOST TRUSTED RE-COMMERCE</span>
                            </div>

                            {/* Mobile View Specifics (Logo + Chips) */}
                            <div className="block xl:hidden w-full space-y-4 pt-0 mb-12">
                                <div className="flex flex-wrap justify-center gap-2 px-2 pt-6 pb-2">
                                    {activeCities.length > 0 ? activeCities.map(city => (
                                        <div key={city} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 text-black dark:text-white text-[10px] font-bold border border-green-200/50 shadow-sm transition-all cursor-default whitespace-nowrap">
                                            <MapPin className="w-3 h-3 text-green-500" />
                                            {city}
                                        </div>
                                    )) : (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 text-black dark:text-white text-[10px] font-bold border border-green-200/50 shadow-sm transition-all cursor-default whitespace-nowrap">
                                            <MapPin className="w-3 h-3 text-green-500" />
                                            Bengaluru
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-center items-center py-2 w-full">
                                    <div className="scale-[1.5] origin-center transform flex justify-center items-center py-4">
                                        <DynamicLogo />
                                    </div>
                                </div>
                                <div className="w-full h-[180px] sm:h-[350px] relative mt-0 mb-16 flex items-center justify-center overflow-visible">
                                    <div className="origin-center w-full h-full">
                                        <HeroAnimation displayPrices={displayPrices} />
                                    </div>
                                </div>
                                <div className="relative z-20 bg-background/80 backdrop-blur-sm pt-2 rounded-xl w-full max-w-full overflow-hidden">
                                    <div className="px-1"><HomeSearch /></div>
                                    <div className="mt-6 w-full overflow-hidden"><BrandRail initialBrands={initialBrands} /></div>
                                    <SellThisDevice brands={initialBrands} />
                                </div>
                            </div>

                            {/* MAIN HEADLINE */}
                            <div className="max-w-full overflow-hidden relative">
                                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.15] md:leading-[1.1]">
                                    Smart way to <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 animate-gradient-x">sell your device.</span>
                                </h1>
                                <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg mt-6 font-medium mx-auto">
                                    Get the <span className="text-green-600 dark:text-green-400 font-bold">Highest Value</span> for your old smartphone, laptop, or Smartwatch instantly. Doorstep pickup in 3 hours.
                                </p>
                            </div>

                            {/* CTA Buttons */}
                            <div className="flex flex-col sm:flex-row gap-4 pt-8 w-full sm:w-auto justify-center mx-auto">
                                <Link
                                    href="/sell"
                                    className="inline-flex items-center justify-center h-14 px-8 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-lg shadow-xl shadow-green-500/20 hover:bg-slate-800 dark:hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group w-full sm:w-auto"
                                >
                                    Check Price
                                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </Link>
                                <Link
                                    href="/orders"
                                    className="inline-flex items-center justify-center h-14 px-8 rounded-2xl bg-green-500 dark:bg-green-600 text-white font-bold text-lg shadow-xl shadow-green-500/20 hover:bg-green-600 dark:hover:bg-green-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 w-full sm:w-auto"
                                >
                                    Track Order
                                </Link>
                            </div>

                            {/* Trust Signals */}
                            <div className="flex items-center justify-center gap-6 pt-8 text-sm font-semibold text-slate-500 dark:text-slate-400 flex-wrap mx-auto">
                                <div className="flex items-center gap-2">
                                    <div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30"><Zap className="w-3.5 h-3.5 text-green-600" /></div>
                                    Instant Cash
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30"><MapPin className="w-3.5 h-3.5 text-blue-600" /></div>
                                    Doorstep Pickup
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="p-1 rounded-full bg-purple-100 dark:bg-purple-900/30"><ShieldCheck className="w-3.5 h-3.5 text-purple-600" /></div>
                                    Safe & Secure
                                </div>
                            </div>
                        </div>

                        {/* Hero Animation (Desktop) */}
                        <div className="hidden xl:flex relative w-full h-[500px] max-w-[800px] animate-in zoom-in-50 fade-in duration-1000 delay-200 perspective-1000 items-center justify-center mx-auto">
                            {/* Decorative Blob under Animation */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-green-500/5 to-emerald-500/5 rounded-full blur-3xl transform scale-90" />
                            <HeroAnimation displayPrices={displayPrices} />
                        </div>
                    </div>
                </div>
            </section>

            {/* Category Selection Section (unchanged) */}
            <section className="py-20 bg-slate-50/50 dark:bg-transparent border-y border-slate-100 dark:border-slate-800/50">
                <div className="container mx-auto px-6">
                    <div className="max-w-4xl mx-auto">
                        <CategorySelector onSelect={handleCategorySelect} />
                    </div>
                </div>
            </section>

            {/* Brands Marquee & Stats Section */}
            <section className="py-12 border-y bg-slate-900 dark:bg-black border-slate-800 dark:border-slate-800/50 w-full overflow-hidden">
                <div className="container mx-auto px-6 mb-12">
                    <p className="text-center text-sm font-semibold text-green-400/60 uppercase tracking-wider mb-8">We Accept All Major Brands</p>
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16 items-center">
                        <span className="text-2xl font-bold text-slate-200 hover:text-white transition-colors cursor-default">Apple</span>
                        <span className="text-2xl font-bold text-blue-400 hover:text-blue-300 transition-colors cursor-default">Samsung</span>
                        <span className="text-2xl font-bold text-blue-400 hover:text-blue-300 transition-colors cursor-default">Vivo</span>
                        <span className="text-2xl font-bold text-red-400 hover:text-red-300 transition-colors cursor-default">OnePlus</span>
                        <span className="text-2xl font-bold text-slate-200 hover:text-white transition-colors cursor-default">Nothing</span>
                        <span className="text-2xl font-bold text-yellow-400 hover:text-yellow-300 transition-colors cursor-default">iQOO</span>
                    </div>
                </div>

                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-slate-700">
                        <div className="p-4">
                            <h3 className="text-3xl md:text-4xl font-bold text-green-400 mb-2">5K+</h3>
                            <p className="text-sm text-slate-400 font-medium">Devices Bought</p>
                        </div>
                        <div className="p-4">
                            <h3 className="text-3xl md:text-4xl font-bold text-emerald-400 mb-2">₹10L+</h3>
                            <p className="text-sm text-slate-400 font-medium">Cash Paid</p>
                        </div>
                        <div className="p-4">
                            <h3 className="text-3xl md:text-4xl font-bold text-teal-400 mb-2">4+</h3>
                            <p className="text-sm text-slate-400 font-medium">Cities Covered</p>
                        </div>
                        <div className="p-4">
                            <h3 className="text-3xl md:text-4xl font-bold text-lime-400 mb-2">4.8★</h3>
                            <p className="text-sm text-slate-400 font-medium">User Rating</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <HowItWorks />

            {/* Reviews Section */}
            <section className="py-24 overflow-hidden w-full">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-6">
                        <div className="space-y-4 max-w-2xl">
                            <h2 className="text-3xl md:text-4xl font-bold dark:text-white">Loved by 1000+ Customers</h2>
                            <p className="text-muted-foreground dark:text-slate-400">Don&apos;t just take our word for it. Here&apos;s what people are saying about Fonzkart.</p>
                        </div>
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(v => <Star key={v} className="w-6 h-6 fill-yellow-400 text-yellow-400" />)}
                            <span className="ml-2 font-bold text-lg dark:text-white">4.9/5 Rating</span>
                        </div>
                    </div>

                    <div className="mt-8">
                        <ReviewsMarquee />
                    </div>
                </div>
            </section>

            {/* Why Choose Us Section */}
            <section className="py-24 bg-slate-950 overflow-hidden w-full relative">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full -mr-64 -mt-64" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full -ml-64 -mb-64 opacity-50" />

                <div className="container mx-auto px-6 relative z-10">
                    <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-20">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                            The Fonzkart Advantage
                        </div>
                        <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-6 leading-none">
                            Why <span className="text-emerald-500">Choose</span> Us
                        </h2>
                        <div className="h-1.5 w-24 bg-gradient-to-r from-emerald-500 to-transparent rounded-full mb-8" />
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Benefit 1: Prices */}
                        <motion.div
                            whileHover={{ y: -10 }}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="group p-8 bg-white/[0.03] border border-white/5 rounded-[2.5rem] relative overflow-hidden transition-all duration-500 hover:bg-white/[0.05] hover:border-emerald-500/30"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-all duration-500" />
                            
                            <div className="relative z-10 space-y-6">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                                    Premium Value
                                </div>
                                
                                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl group-hover:scale-110 group-hover:bg-emerald-500 transition-all duration-500">
                                    <PriceGraphic className="w-8 h-8 group-hover:text-slate-950 transition-colors" />
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-2xl font-black text-white tracking-tight group-hover:text-emerald-400 transition-colors">Amazing Prices</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed font-medium">
                                        We use real-time market indexing to guarantee you the absolute highest cash offer for your device compared to any competitor.
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        {/* Benefit 2: Speed */}
                        <motion.div
                            whileHover={{ y: -10 }}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="group p-8 bg-white/[0.03] border border-white/5 rounded-[2.5rem] relative overflow-hidden transition-all duration-500 hover:bg-white/[0.05] hover:border-emerald-500/30"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-all duration-500" />
                            
                            <div className="relative z-10 space-y-6">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                                    Instant Service
                                </div>
                                
                                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl group-hover:scale-110 group-hover:bg-emerald-500 transition-all duration-500">
                                    <SpeedGraphic className="w-8 h-8 group-hover:text-slate-950 transition-colors" />
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-2xl font-black text-white tracking-tight group-hover:text-emerald-400 transition-colors">3-Hour Pickup</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed font-medium">
                                        No waiting for days. Our field executives reach your doorstep within 3 hours of order confirmation. Instant cash on the spot.
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        {/* Benefit 3: Safety */}
                        <motion.div
                            whileHover={{ y: -10 }}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="group p-8 bg-white/[0.03] border border-white/5 rounded-[2.5rem] relative overflow-hidden transition-all duration-500 hover:bg-white/[0.05] hover:border-emerald-500/30"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-all duration-500" />
                            
                            <div className="relative z-10 space-y-6">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                                    Data Shield
                                </div>
                                
                                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl group-hover:scale-110 group-hover:bg-emerald-500 transition-all duration-500">
                                    <SecurityGraphic className="w-8 h-8 group-hover:text-slate-950 transition-colors" />
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-2xl font-black text-white tracking-tight group-hover:text-emerald-400 transition-colors">Safety Guaranteed</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed font-medium">
                                        Your privacy is our mission. We perform a certified 100% data wipe for every device we purchase. Safe and secure.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>
        </div>
    );
}
