// The customer's refurbished device orders and repair bookings, on My Orders (as in the Customer app's Orders tab).
import { REPAIR_SLOTS, REPAIR_STATUSES, gradeLabel, inr, issueLabel, type RefurbishedOrder, type RepairBooking } from '@/lib/buyRepair';
import { SHOP_ORDER_STATUSES } from '@/lib/shop';

const badge = 'rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary';

export function BuyRepairOrders({ orders, bookings }: { orders: RefurbishedOrder[]; bookings: RepairBooking[] }) {
    return (
        <>
            {orders.length ? (
                <section className="mb-10">
                    <h2 className="mb-4 text-xl font-bold">Refurbished devices</h2>
                    <div className="grid gap-4">
                        {orders.map(order => (
                            <article key={order.id} className="flex gap-4 rounded-2xl border bg-card p-4">
                                {order.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={order.imageUrl} alt={order.deviceName} className="h-20 w-16 shrink-0 object-contain" />
                                ) : null}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="font-bold">Order #{order.orderNumber}</p>
                                        <span className={badge}>{SHOP_ORDER_STATUSES.find(s => s.id === order.status)?.label ?? order.status}</span>
                                    </div>
                                    <p className="mt-1 text-sm">{order.deviceName} · {order.storage} · {gradeLabel(order.grade)}</p>
                                    <p className="text-sm text-muted-foreground">{order.warrantyMonths}-month warranty</p>
                                    <p className="mt-1 text-sm font-bold">{inr(order.price)} · cash on delivery</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            ) : null}
            {bookings.length ? (
                <section className="mb-10">
                    <h2 className="mb-4 text-xl font-bold">Repairs</h2>
                    <div className="grid gap-4">
                        {bookings.map(b => (
                            <article key={b.id} className="rounded-2xl border bg-card p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-bold">Booking #{b.bookingNumber}</p>
                                    <span className={badge}>{REPAIR_STATUSES.find(s => s.id === b.status)?.label ?? b.status}</span>
                                </div>
                                <p className="mt-1 text-sm">{issueLabel(b.issue)} · {b.brand} {b.model}</p>
                                <p className="text-sm text-muted-foreground">
                                    Visit {new Date(`${b.visitDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, {REPAIR_SLOTS.find(s => s.id === b.slot)?.time ?? b.slot}
                                </p>
                                <p className="mt-1 text-sm font-bold">{inr(b.price)} · pay after the repair</p>
                            </article>
                        ))}
                    </div>
                </section>
            ) : null}
        </>
    );
}
