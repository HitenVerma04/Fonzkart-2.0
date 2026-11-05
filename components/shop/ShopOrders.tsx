import { SHOP_ORDER_STATUSES, type ShopOrder } from '@/lib/shop';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** The customer's screen guard orders, on My Orders. */
export function ShopOrders({ orders }: { orders: ShopOrder[] }) {
    if (!orders.length) return null;
    return (
        <section className="mb-10">
            <h2 className="mb-4 text-xl font-bold">Screen guards</h2>
            <div className="grid gap-4">
                {orders.map(order => (
                    <article key={order.id} className="rounded-2xl border bg-card p-4">
                        <div className="flex items-center justify-between gap-3">
                            <p className="font-bold">Order #{order.orderNumber}</p>
                            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{SHOP_ORDER_STATUSES.find(s => s.id === order.status)?.label ?? order.status}</span>
                        </div>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {order.items.map(item => <li key={item.screenGuardId}>{item.quantity} × {item.name}</li>)}
                        </ul>
                        <p className="mt-2 text-sm font-bold">{inr(order.total)} · cash on delivery</p>
                    </article>
                ))}
            </div>
        </section>
    );
}
