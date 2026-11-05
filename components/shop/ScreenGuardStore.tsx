'use client';

// The screen guard store, as in the Customer app: pick the brand, search the exact model, add guards to the cart.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Minus, Plus, Search, ShieldCheck, ShoppingCart } from 'lucide-react';
import { discountPercent, type ScreenGuard, type ScreenGuardStore as Store } from '@/lib/shop';
import { GuardPicture } from './GuardPicture';
import { MAX_QUANTITY, useCart } from './cart';

const PROMISES = ['Confirmed fit for your exact model', 'Cash on delivery', 'Installation guide included'];
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function PriceBlock({ guard, showDiscount }: { guard: ScreenGuard; showDiscount: boolean }) {
    const off = showDiscount ? discountPercent(guard.mrp, guard.price) : 0;
    return (
        <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-lg font-black">{inr(guard.price)}</span>
            {off ? <span className="text-sm text-muted-foreground line-through">{inr(guard.mrp)}</span> : null}
            {off ? <span className="text-sm font-bold text-primary">{off}% off</span> : null}
        </div>
    );
}

export function ScreenGuardStore({ store }: { store: Store }) {
    const { lines, setQuantity } = useCart();
    const [brand, setBrand] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const brands = useMemo(() => [...new Set(store.items.map(i => i.brand))], [store.items]);
    const words = normal(query);
    const shown = store.items.filter(i => (!brand || i.brand === brand) && (!words || normal(i.model).includes(words)));
    const quantityOf = (id: string) => lines.find(l => l.screenGuardId === id)?.quantity ?? 0;
    const count = lines.reduce((sum, l) => sum + l.quantity, 0);
    const total = lines.reduce((sum, l) => sum + (store.items.find(i => i.id === l.screenGuardId)?.price ?? 0) * l.quantity, 0);

    return (
        <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
            <section className="rounded-3xl p-6 text-white md:p-10" style={{ background: 'var(--hero)' }}>
                <ShieldCheck className="mb-3 h-10 w-10" />
                <h1 className="text-3xl font-black md:text-4xl">Screen guards</h1>
                <ul className="mt-3 space-y-1">
                    {PROMISES.map(p => <li key={p} className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4" />{p}</li>)}
                </ul>
            </section>

            <section className="mt-5 rounded-2xl border bg-card p-4">
                <h2 className="font-bold">Find your guard</h2>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                    {[null, ...brands].map(b => (
                        <button key={b ?? 'all'} onClick={() => setBrand(b)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${brand === b ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}>
                            {b ?? 'All brands'}
                        </button>
                    ))}
                </div>
                <label className="mt-3 flex items-center gap-2 rounded-full bg-muted px-4 py-2.5">
                    <Search className="h-4 w-4 text-primary" />
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${store.items.length} models`} className="w-full bg-transparent text-sm outline-none" />
                </label>
            </section>

            {shown.length ? (
                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                    {shown.map(guard => {
                        const quantity = quantityOf(guard.id);
                        const off = store.discountsEnabled ? discountPercent(guard.mrp, guard.price) : 0;
                        return (
                            <article key={guard.id} className="relative flex flex-col gap-2 rounded-2xl border bg-card p-3">
                                {off ? <span className="absolute left-2 top-2 z-10 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">-{off}%</span> : null}
                                <GuardPicture model={guard.model} photo={guard.imageUrl} />
                                <h3 className="min-h-10 text-sm font-semibold leading-5">{guard.name}</h3>
                                <PriceBlock guard={guard} showDiscount={store.discountsEnabled} />
                                {quantity ? (
                                    <div className="mt-auto flex items-center justify-between rounded-full bg-primary/10 p-1">
                                        <button aria-label={`One less ${guard.name}`} onClick={() => setQuantity(guard.id, quantity - 1)} className="rounded-full p-2 hover:bg-primary/15"><Minus className="h-4 w-4" /></button>
                                        <span className="font-bold">{quantity}</span>
                                        <button aria-label={`One more ${guard.name}`} disabled={quantity >= MAX_QUANTITY} onClick={() => setQuantity(guard.id, quantity + 1)} className="rounded-full bg-primary p-2 text-primary-foreground disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                                    </div>
                                ) : (
                                    <button onClick={() => setQuantity(guard.id, 1)} className="mt-auto flex items-center justify-center gap-2 rounded-full bg-primary/10 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/20">
                                        <ShoppingCart className="h-4 w-4" /> Add
                                    </button>
                                )}
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div className="mt-8 rounded-2xl border bg-card p-10 text-center">
                    <p className="font-semibold">No guards for this model yet</p>
                    <button onClick={() => { setBrand(null); setQuery(''); }} className="mt-3 text-sm font-bold text-primary">Show all guards</button>
                </div>
            )}

            {count ? (
                <Link href="/screen-guard/cart" className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-xl items-center justify-between rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground shadow-xl md:bottom-6">
                    <span>{count} {count === 1 ? 'item' : 'items'} · {inr(total)}</span>
                    <span>View cart</span>
                </Link>
            ) : null}
        </div>
    );
}
