import { prisma } from '@/lib/db';
import { getDeviceDisplayPrices, updateDeviceDisplayPrice, toggleFeaturedCity, updateCityDisplayOrder } from '@/actions/admin';
import { Banknote, MapPin, Save, Star, ArrowUpDown, Layout } from 'lucide-react';
import BannerPriceCard from '@/components/admin/BannerPriceCard';
import CityOrderCard from '@/components/admin/CityOrderCard';
import { redirect } from 'next/navigation';
import { ADMINS, hasStaffRole } from '@/lib/staff-access';

export const dynamic = 'force-dynamic';

export default async function HomepageModificationsPage() {
    // Landing-page settings are for administrators (sidebar: SUPER_ADMIN and ADMIN only).
    if (!(await hasStaffRole(ADMINS))) redirect('/admin');

    const bannerPrices = await getDeviceDisplayPrices();

    const cities = await prisma.city.findMany({
        where: { isActive: true },
        orderBy: [
            { isFeatured: 'desc' },
            { displayOrder: 'asc' },
            { name: 'asc' }
        ]
    });

    return (
        <div className="space-y-10 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col gap-2 border-b pb-8">
                <div className="flex items-center gap-3 text-primary">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Layout className="w-6 h-6" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight tracking-[-0.04em]">Landing Page Modifications</h1>
                </div>
                <p className="text-muted-foreground text-sm font-medium">
                    Adjust public-facing homepage content, including the FonzKart Pay hero wallet banner prices and city priority.
                </p>
            </div>

            {/* Banner Prices Section */}
            <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                            <Banknote className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight">Banner Offer Prices (FonzKart Pay Wallet)</h2>
                            <p className="text-xs text-muted-foreground">
                                These prices display live on the Home Screen animation in the green FonzKart Pay card.
                            </p>
                        </div>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full w-fit">
                        Live on Homepage
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bannerPrices.map((price) => (
                        <BannerPriceCard key={price.categoryKey || price.id} price={price} />
                    ))}
                </div>
            </section>

            {/* Featured Cities Section */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black tracking-tight">Homepage City Selector</h2>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-1 bg-muted rounded-full">
                        Ordered List
                    </div>
                </div>

                <div className="bg-muted/30 border rounded-3xl p-2">
                    <div className="grid grid-cols-1 gap-2">
                        {cities.map((city, index) => (
                            <CityOrderCard key={city.id} city={city} index={index} />
                        ))}
                    </div>
                </div>
                
                <div className="p-6 bg-slate-50 dark:bg-white/5 border border-dashed rounded-2xl">
                    <p className="text-xs text-muted-foreground font-medium leading-relaxed italic">
                        Tip: Set "Featured" status to keep key cities like Bangalore at the very top. Use the "Display Order" to fine-tune the relative positions. Cities with Featured=ON always appear before others.
                    </p>
                </div>
            </section>
        </div>
    );
}
