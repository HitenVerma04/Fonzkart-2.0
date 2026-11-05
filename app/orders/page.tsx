
import { getUserOrders } from '@/actions/orders';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { Smartphone } from 'lucide-react';
import Link from 'next/link';
import OrderCard from '@/components/orders/OrderCard';
import { ShopOrders } from '@/components/shop/ShopOrders';
import { fetchMyShopOrders } from '@/actions/shop';

export default async function OrdersPage() {
    const session = await getSession();
    if (!session) {
        redirect('/login');
    }

    const [orders, shopOrders] = await Promise.all([getUserOrders(), fetchMyShopOrders()]);

    return (
        <div className="container mx-auto py-10 px-4">
            <h1 className="text-3xl font-bold mb-8">My Orders</h1>

            <ShopOrders orders={shopOrders} />

            {orders.length === 0 && shopOrders.length > 0 ? null : orders.length === 0 ? (
                <div className="text-center py-20 bg-accent/20 rounded-2xl">
                    <Smartphone className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                    <p className="text-lg font-medium">No orders yet</p>
                    <p className="text-muted-foreground mb-6">Start selling your old phones for cash!</p>
                    <Link href="/sell" className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-colors">
                        Sell Now
                    </Link>
                </div>
            ) : (
                <div className="grid gap-6">
                    {orders.map((order) => (
                        <OrderCard key={order.id} order={order} />
                    ))}
                </div>
            )}
        </div>
    );
}
