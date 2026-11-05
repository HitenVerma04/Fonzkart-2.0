'use client';

// The screen guard store for administrators: the store and discount switches, the orders, and each guard's prices and
// visibility. Same controls as the Admin app.
import { useMemo, useState } from 'react';
import { saveScreenGuard, saveShopSettings, setShopOrderStatus } from '@/actions/shop';
import { SHOP_ORDER_STATUSES, type ScreenGuard, type ShopOrder, type ShopOrderStatus, type ShopSettings } from '@/lib/shop';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function Switch({ label, on, disabled, onChange }: { label: string; on: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
    return (
        <label className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4">
            <span className="font-bold">{label}</span>
            <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={on} disabled={disabled} onChange={e => onChange(e.target.checked)} />
        </label>
    );
}

function GuardRow({ initial }: { initial: ScreenGuard }) {
    const [guard, setGuard] = useState(initial);
    const [saved, setSaved] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const changed = guard.mrp !== saved.mrp || guard.price !== saved.price || guard.isActive !== saved.isActive;
    const invalid = !(guard.mrp > 0) || !(guard.price > 0) || guard.price > guard.mrp;

    const save = async () => {
        setBusy(true);
        setError('');
        const result = await saveScreenGuard(guard);
        setBusy(false);
        if (result.ok) setSaved(guard);
        else setError(result.error);
    };

    return (
        <tr className="border-t">
            <td className="p-2 text-sm font-medium">{guard.name}{error ? <span className="block text-xs text-red-500">{error}</span> : null}</td>
            <td className="p-2"><input aria-label={`MRP of ${guard.name}`} type="number" min={1} className="w-24 rounded-lg border bg-background px-2 py-1 text-sm" value={guard.mrp} onChange={e => setGuard({ ...guard, mrp: Number(e.target.value) })} /></td>
            <td className="p-2"><input aria-label={`Price of ${guard.name}`} type="number" min={1} className="w-24 rounded-lg border bg-background px-2 py-1 text-sm" value={guard.price} onChange={e => setGuard({ ...guard, price: Number(e.target.value) })} /></td>
            <td className="p-2 text-center"><input aria-label={`Show ${guard.name} in the store`} type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={guard.isActive} onChange={e => setGuard({ ...guard, isActive: e.target.checked })} /></td>
            <td className="p-2 text-right">{changed ? <button disabled={busy || invalid} onClick={save} className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button> : null}</td>
        </tr>
    );
}

function OrderCard({ order }: { order: ShopOrder }) {
    const [status, setStatus] = useState(order.status);
    const [error, setError] = useState('');

    const change = async (next: ShopOrderStatus) => {
        const previous = status;
        setStatus(next);
        setError('');
        const result = await setShopOrderStatus(order.id, next);
        if (!result.ok) {
            setStatus(previous);
            setError(result.error);
        }
    };

    return (
        <article className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-bold">Order #{order.orderNumber} · {inr(order.total)}</p>
                <select aria-label={`Status of order ${order.orderNumber}`} value={status} onChange={e => change(e.target.value as ShopOrderStatus)} className="rounded-lg border bg-background px-2 py-1 text-sm">
                    {SHOP_ORDER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
                {order.items.map(item => <li key={item.screenGuardId}>{item.quantity} × {item.name}</li>)}
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">{order.name} · {order.phone}{order.customerEmail ? ` · ${order.customerEmail}` : ''}</p>
            <p className="text-sm text-muted-foreground">{order.address}, {order.pincode}</p>
            {error ? <p className="mt-1 text-sm text-red-500">{error}</p> : null}
        </article>
    );
}

export function ShopAdmin({ settings: initial, items, orders }: { settings: ShopSettings; items: ScreenGuard[]; orders: ShopOrder[] }) {
    const [settings, setSettings] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [hidden, setHidden] = useState(false);
    const shown = useMemo(() => {
        const words = query.trim().toLowerCase();
        return items.filter(i => i.isActive !== hidden && (!words || i.name.toLowerCase().includes(words))).slice(0, 100);
    }, [items, query, hidden]);

    const save = async (next: ShopSettings) => {
        const previous = settings;
        setSettings(next);
        setBusy(true);
        setError('');
        const result = await saveShopSettings(next);
        setBusy(false);
        if (!result.ok) {
            setSettings(previous);
            setError(result.error);
        }
    };

    return (
        <div className="space-y-8">
            <section className="grid gap-3 md:grid-cols-2">
                <Switch label="Store open" on={settings.storeEnabled} disabled={busy} onChange={storeEnabled => save({ ...settings, storeEnabled })} />
                <Switch label="Show discounts" on={settings.discountsEnabled} disabled={busy} onChange={discountsEnabled => save({ ...settings, discountsEnabled })} />
                {error ? <p className="text-sm text-red-500">{error}</p> : null}
            </section>

            <section>
                <h2 className="mb-3 text-xl font-bold">Orders ({orders.length})</h2>
                {orders.length ? <div className="grid gap-3">{orders.map(order => <OrderCard key={order.id} order={order} />)}</div> : <p className="text-sm text-muted-foreground">No orders yet.</p>}
            </section>

            <section>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-bold">Guards</h2>
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search" className="rounded-full border bg-background px-4 py-1.5 text-sm" />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} /> Hidden guards</label>
                    <span className="text-sm text-muted-foreground">Showing {shown.length}</span>
                </div>
                <div className="overflow-x-auto rounded-2xl border bg-card">
                    <table className="w-full text-left">
                        <thead><tr className="text-xs text-muted-foreground"><th className="p-2">Guard</th><th className="p-2">MRP</th><th className="p-2">Price</th><th className="p-2 text-center">In store</th><th className="p-2" /></tr></thead>
                        <tbody>{shown.map(guard => <GuardRow key={guard.id} initial={guard} />)}</tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
