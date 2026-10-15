import { db } from "@/lib/store";
import { Layers, Smartphone, Tag, ShoppingCart, PlusCircle, Monitor, Headphones, Gamepad2, Tv, Camera } from "lucide-react";
import Link from 'next/link';
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Sync2026Models from "@/components/admin/Sync2026Models";

export const dynamic = 'force-dynamic';


export default async function AdminDashboard() {
    const session = await getSession();
    const role = session?.user?.role;

    if (role === 'FIELD_EXECUTIVE') {
        redirect('/admin/orders');
    }

    if (role === 'ZONAL_HEAD' || role === 'PARTNER') {
        redirect('/admin/orders');
    }

    if (role === 'RELATIONSHIP_MANAGER') {
        redirect('/admin/rm-dashboard');
    }

    const brands = await db.getBrands();
    const models = await db.getModels();
    const variants = await db.getVariants();
    // Orders are separate but nice to see
    // const orders = db.getOrders(..); // Need to get all orders, store logic only gets by user currently.

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold">Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-card dark:bg-white/[0.03] dark:backdrop-blur-xl border border-border dark:border-white/10 rounded-xl shadow-sm hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(19,226,91,0.15)] transition-all duration-300 flex items-center gap-4">
                    <div className="p-4 bg-blue-100 text-blue-600 rounded-lg">
                        <Smartphone className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Total Brands</p>
                        <h3 className="text-3xl font-bold">{brands.length}</h3>
                    </div>
                </div>

                <div className="p-6 bg-card dark:bg-white/[0.03] dark:backdrop-blur-xl border border-border dark:border-white/10 rounded-xl shadow-sm hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(19,226,91,0.15)] transition-all duration-300 flex items-center gap-4">
                    <div className="p-4 bg-green-100 text-green-600 rounded-lg">
                        <Layers className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Total Models</p>
                        <h3 className="text-3xl font-bold">{models.length}</h3>
                    </div>
                </div>

                <div className="p-6 bg-card dark:bg-white/[0.03] dark:backdrop-blur-xl border border-border dark:border-white/10 rounded-xl shadow-sm hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(19,226,91,0.15)] transition-all duration-300 flex items-center gap-4">
                    <div className="p-4 bg-purple-100 text-purple-600 rounded-lg">
                        <Tag className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Price Variants</p>
                        <h3 className="text-3xl font-bold">{variants.length}</h3>
                    </div>
                </div>
            </div>

            <Sync2026Models />

            <div className="space-y-4">
                <h2 className="text-xl font-bold">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Link href="/admin/category/smartphone" className="p-6 bg-card dark:bg-white/[0.03] dark:backdrop-blur-xl border border-border dark:border-white/10 rounded-xl hover:bg-muted/50 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(19,226,91,0.2)] transition-all duration-300 flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-semibold">
                            <Smartphone className="w-5 h-5 text-blue-600" />
                            Manage Smartphones
                        </div>
                        <p className="text-sm text-muted-foreground">Manage brands, models, and pricing for smartphones.</p>
                    </Link>
                    <Link href="/admin/category/tablet" className="p-6 bg-card dark:bg-white/[0.03] dark:backdrop-blur-xl border border-border dark:border-white/10 rounded-xl hover:bg-muted/50 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(19,226,91,0.2)] transition-all duration-300 flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-semibold">
                            <PlusCircle className="w-5 h-5 text-green-600" />
                            Manage Tablets
                        </div>
                        <p className="text-sm text-muted-foreground">Manage brands, models, and pricing for tablets.</p>
                    </Link>
                    <Link href="/admin/category/console" className="p-6 bg-card dark:bg-white/[0.03] dark:backdrop-blur-xl border border-border dark:border-white/10 rounded-xl hover:bg-muted/50 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(19,226,91,0.2)] transition-all duration-300 flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-semibold">
                            <Gamepad2 className="w-5 h-5 text-red-600" />
                            Manage Consoles
                        </div>
                        <p className="text-sm text-muted-foreground">Manage brands, models, and pricing for gaming consoles.</p>
                    </Link>
                    <Link href="/admin/category/smarttv" className="p-6 bg-card dark:bg-white/[0.03] dark:backdrop-blur-xl border border-border dark:border-white/10 rounded-xl hover:bg-muted/50 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(19,226,91,0.2)] transition-all duration-300 flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-semibold">
                            <Tv className="w-5 h-5 text-emerald-600" />
                            Manage Smart TVs
                        </div>
                        <p className="text-sm text-muted-foreground">Manage brands, models, and pricing for televisions.</p>
                    </Link>
                    <Link href="/admin/category/camera" className="p-6 bg-card dark:bg-white/[0.03] dark:backdrop-blur-xl border border-border dark:border-white/10 rounded-xl hover:bg-muted/50 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(19,226,91,0.2)] transition-all duration-300 flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-semibold">
                            <Camera className="w-5 h-5 text-yellow-600" />
                            Manage Cameras
                        </div>
                        <p className="text-sm text-muted-foreground">Manage brands, models, and pricing for DSLR cameras.</p>
                    </Link>
                    <Link href="/admin/category/laptop" className="p-6 bg-card dark:bg-white/[0.03] dark:backdrop-blur-xl border border-border dark:border-white/10 rounded-xl hover:bg-muted/50 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(19,226,91,0.2)] transition-all duration-300 flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-semibold">
                            <PlusCircle className="w-5 h-5 text-purple-600" />
                            Manage Laptops
                        </div>
                        <p className="text-sm text-muted-foreground">Manage brands, models, and pricing for laptops.</p>
                    </Link>
                    <Link href="/admin/category/desktop" className="p-6 bg-card dark:bg-white/[0.03] dark:backdrop-blur-xl border border-border dark:border-white/10 rounded-xl hover:bg-muted/50 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(19,226,91,0.2)] transition-all duration-300 flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-semibold">
                            <Monitor className="w-5 h-5 text-cyan-600" />
                            Manage Desktops
                        </div>
                        <p className="text-sm text-muted-foreground">Manage brands, models, and pricing for desktop PCs.</p>
                    </Link>
                    <Link href="/admin/category/earbuds" className="p-6 bg-card dark:bg-white/[0.03] dark:backdrop-blur-xl border border-border dark:border-white/10 rounded-xl hover:bg-muted/50 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(19,226,91,0.2)] transition-all duration-300 flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-semibold">
                            <Headphones className="w-5 h-5 text-fuchsia-600" />
                            Manage Earbuds
                        </div>
                        <p className="text-sm text-muted-foreground">Manage brands, models, and pricing for wireless earbuds.</p>
                    </Link>
                    <Link href="/admin/riders" className="p-6 bg-card dark:bg-white/[0.03] dark:backdrop-blur-xl border border-border dark:border-white/10 rounded-xl hover:bg-muted/50 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(19,226,91,0.2)] transition-all duration-300 flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-semibold">
                            <PlusCircle className="w-5 h-5 text-orange-600" />
                            Manage Executives
                        </div>
                        <p className="text-sm text-muted-foreground">Add and manage delivery partners and executives.</p>
                    </Link>
                    <Link href="/admin/orders" className="p-6 bg-card dark:bg-white/[0.03] dark:backdrop-blur-xl border border-border dark:border-white/10 rounded-xl hover:bg-muted/50 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(19,226,91,0.2)] transition-all duration-300 flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-semibold">
                            <ShoppingCart className="w-5 h-5 text-indigo-600" />
                            View Orders
                        </div>
                        <p className="text-sm text-muted-foreground">Track orders and assign riders for pickup.</p>
                    </Link>
                </div>
            </div>
        </div>
    );
}
