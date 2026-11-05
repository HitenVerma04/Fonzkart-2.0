'use client';

// The cart and cash-on-delivery checkout. The server prices the order, so what is shown here is only for reading.
import { useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { placeShopOrder } from '@/actions/shop';
import { discountPercent, type ScreenGuardStore, type ShopOrder } from '@/lib/shop';
import { GuardPicture } from './GuardPicture';
import { MAX_QUANTITY, useCart } from './cart';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const field = 'w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-primary';

export function CartCheckout({ store, signedIn, defaultName }: { store: ScreenGuardStore; signedIn: boolean; defaultName: string }) {
    const { lines, setQuantity, clear } = useCart();
    const [form, setForm] = useState({ name: defaultName, phone: '', address: '', pincode: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [placed, setPlaced] = useState<ShopOrder | null>(null);
    const rows = lines.flatMap(l => {
        const item = store.items.find(i => i.id === l.screenGuardId);
        return item ? [{ item, quantity: l.quantity }] : [];
    });
    const total = rows.reduce((sum, r) => sum + r.item.price * r.quantity, 0);
    const mrp = rows.reduce((sum, r) => sum + r.item.mrp * r.quantity, 0);
    const valid = form.name.trim().length > 1 && /^\d{10}$/.test(form.phone) && form.address.trim().length > 5 && /^\d{6}$/.test(form.pincode);

    const submit = async () => {
        setBusy(true);
        setError('');
        const result = await placeShopOrder({ items: rows.map(r => ({ screenGuardId: r.item.id, quantity: r.quantity })), name: form.name.trim(), phone: form.phone, address: form.address.trim(), pincode: form.pincode });
        setBusy(false);
        if (result.ok) {
            setPlaced(result.data ?? null);
            clear();
        } else setError(result.error);
    };

    if (placed) {
        return (
            <div className="mx-auto max-w-xl px-4 py-16 text-center">
                <h1 className="text-3xl font-black">Order placed</h1>
                <p className="mt-2 text-muted-foreground">Order #{placed.orderNumber} · {inr(placed.total)} · cash on delivery</p>
                <Link href="/orders" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">See my orders</Link>
            </div>
        );
    }
    if (!rows.length) {
        return (
            <div className="mx-auto max-w-xl px-4 py-16 text-center">
                <h1 className="text-2xl font-black">Your cart is empty</h1>
                <Link href="/screen-guard" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Browse screen guards</Link>
            </div>
        );
    }
    return (
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-[1fr_380px]">
            <section className="space-y-3">
                <h1 className="text-2xl font-black">Your cart</h1>
                {rows.map(({ item, quantity }) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                        <div className="w-20 shrink-0"><GuardPicture model={item.model} photo={item.imageUrl} /></div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{item.name}</p>
                            <p className="text-sm font-bold">{inr(item.price * quantity)} {discountPercent(item.mrp, item.price) ? <span className="font-normal text-muted-foreground line-through">{inr(item.mrp * quantity)}</span> : null}</p>
                            <div className="mt-2 flex items-center gap-2">
                                <button aria-label="One less" onClick={() => setQuantity(item.id, quantity - 1)} className="rounded-full bg-muted p-1.5"><Minus className="h-3.5 w-3.5" /></button>
                                <span className="w-5 text-center text-sm font-bold">{quantity}</span>
                                <button aria-label="One more" disabled={quantity >= MAX_QUANTITY} onClick={() => setQuantity(item.id, quantity + 1)} className="rounded-full bg-muted p-1.5 disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
                                <button aria-label={`Remove ${item.name}`} onClick={() => setQuantity(item.id, 0)} className="ml-auto p-1.5 text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </section>
            <section className="h-fit space-y-3 rounded-2xl border bg-card p-4">
                <h2 className="font-bold">Delivery details</h2>
                {signedIn ? (
                    <>
                        <input className={field} placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        <input className={field} placeholder="10-digit phone" inputMode="numeric" maxLength={10} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} />
                        <textarea className={field} placeholder="Full address" rows={3} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                        <input className={field} placeholder="6-digit pincode" inputMode="numeric" maxLength={6} value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '') })} />
                    </>
                ) : <p className="text-sm text-muted-foreground">Sign in to place your order. Your cart stays here.</p>}
                <div className="flex justify-between border-t pt-3 text-sm"><span>MRP</span><span>{inr(mrp)}</span></div>
                {mrp > total ? <div className="flex justify-between text-sm text-primary"><span>You save</span><span>{inr(mrp - total)}</span></div> : null}
                <div className="flex justify-between font-black"><span>To pay on delivery</span><span>{inr(total)}</span></div>
                {error ? <p className="text-sm text-red-500">{error}</p> : null}
                {signedIn ? (
                    <button disabled={!valid || busy} onClick={submit} className="w-full rounded-full bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">{busy ? 'Placing order…' : 'Place order · cash on delivery'}</button>
                ) : (
                    <Link href="/login" className="block w-full rounded-full bg-primary py-3 text-center font-bold text-primary-foreground">Sign in to continue</Link>
                )}
            </section>
        </div>
    );
}
