'use client';

// The screen guard store for administrators: the store and discount switches, the orders, and each guard's prices and
// visibility. Same controls as the Admin app: the discount can be typed as a sale price or as a percent off the MRP
// (each updates the other), for one guard or for every guard at once.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveScreenGuard, saveShopSettings, setShopOrderStatus } from '@/actions/shop';
import { SHOP_ORDER_STATUSES, discountPercent, type ScreenGuard, type ShopOrder, type ShopOrderStatus, type ShopSettings } from '@/lib/shop';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
/** The sale price for a percent off the MRP, rounded down so the shown "% off" is never less than asked. */
const priceFor = (mrp: number, percent: number) => Math.max(1, Math.floor((mrp * (100 - Math.min(Math.max(percent, 0), 99))) / 100));
const QUICK_PERCENTS = [0, 10, 15, 20, 25, 30, 40, 50];

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
    // The percent as typed; empty when the price was typed (then the percent is worked out from it).
    const [pctText, setPctText] = useState('');
    const off = discountPercent(guard.mrp, guard.price);
    const changed = guard.mrp !== saved.mrp || guard.price !== saved.price || guard.isActive !== saved.isActive;
    const invalid = !(guard.mrp > 0) || !(guard.price > 0) || guard.price > guard.mrp;

    const save = async () => {
        setBusy(true);
        setError('');
        const result = await saveScreenGuard(guard);
        setBusy(false);
        if (result.ok) { setSaved(guard); setPctText(''); }
        else setError(result.error);
    };

    return (
        <tr className="border-t">
            <td className="p-2 text-sm font-medium">{guard.name}{error ? <span className="block text-xs text-red-500">{error}</span> : null}</td>
            <td className="p-2"><input aria-label={`MRP of ${guard.name}`} type="number" min={1} className="w-24 rounded-lg border bg-background px-2 py-1 text-sm" value={guard.mrp}
                onChange={e => { const mrp = Number(e.target.value); setGuard({ ...guard, mrp, price: pctText !== '' ? priceFor(mrp, Number(pctText)) : guard.price }); }} /></td>
            <td className="p-2"><div className="flex items-center gap-1"><input aria-label={`Discount percent of ${guard.name}`} type="number" min={0} max={99} className="w-16 rounded-lg border bg-background px-2 py-1 text-sm" value={pctText !== '' ? pctText : off}
                onChange={e => { const t = e.target.value.replace(/\D/g, '').slice(-2); setPctText(t); setGuard({ ...guard, price: t === '' ? guard.mrp : priceFor(guard.mrp, Number(t)) }); }} /><span className="text-xs text-muted-foreground">%</span></div></td>
            <td className="p-2 whitespace-nowrap"><input aria-label={`Price of ${guard.name}`} type="number" min={1} className="w-24 rounded-lg border bg-background px-2 py-1 text-sm" value={guard.price} onChange={e => { setPctText(''); setGuard({ ...guard, price: Number(e.target.value) }); }} />
                {off ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{off}% off</span> : null}</td>
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
    const router = useRouter();
    const [bulkPct, setBulkPct] = useState('');
    const [bulkMessage, setBulkMessage] = useState<{ ok: boolean; text: string } | null>(null);
    // Rows keep their own edits; when the saved prices change ("every guard", another admin) they start again from them.
    const [version, setVersion] = useState(0);
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

    /** One percent off every guard's own MRP (all guards, not only the ones shown); stops at the first failure. */
    const applyToAll = async (percent: number) => {
        setBusy(true);
        setBulkMessage(null);
        let done = 0;
        for (const guard of items) {
            const result = await saveScreenGuard({ ...guard, price: priceFor(guard.mrp, percent) });
            if (!result.ok) {
                setBulkMessage({ ok: false, text: `Updated ${done} of ${items.length}. ${guard.name}: ${result.error}` });
                break;
            }
            done++;
        }
        if (done === items.length) {
            setBulkMessage({ ok: true, text: percent ? `${percent}% off applied to all ${done} guards.` : `Discount removed: all ${done} guards sell at MRP.` });
            setBulkPct('');
        }
        setBusy(false);
        router.refresh();
        setVersion(v => v + 1);
    };

    return (
        <div className="space-y-8">
            <section className="grid gap-3 md:grid-cols-2">
                <Switch label="Store open" on={settings.storeEnabled} disabled={busy} onChange={storeEnabled => save({ ...settings, storeEnabled })} />
                <Switch label="Show discounts" on={settings.discountsEnabled} disabled={busy} onChange={discountsEnabled => save({ ...settings, discountsEnabled })} />
                {error ? <p className="text-sm text-red-500">{error}</p> : null}
            </section>

            {items.length ? (
                <section className="rounded-2xl border bg-card p-4">
                    <h2 className="text-lg font-bold">Discount on every guard</h2>
                    <p className="text-sm text-muted-foreground">Sets each guard's price to this percent off its own MRP. You can still change single guards below.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {QUICK_PERCENTS.map(p => (
                            <button key={p} type="button" onClick={() => setBulkPct(String(p))}
                                className={`rounded-full border px-3 py-1 text-sm font-bold ${bulkPct === String(p) ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}`}>
                                {p ? `${p}%` : 'None'}
                            </button>
                        ))}
                        <input aria-label="Discount percent for every guard" type="number" min={0} max={99} value={bulkPct} placeholder="%"
                            onChange={e => setBulkPct(e.target.value.replace(/\D/g, '').slice(-2))} className="w-20 rounded-lg border bg-background px-2 py-1 text-sm" />
                        <button type="button" disabled={bulkPct === '' || busy} onClick={() => applyToAll(Number(bulkPct))}
                            className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
                            {busy ? 'Applying…' : bulkPct === '' ? 'Apply to all' : `Apply ${bulkPct}% to all ${items.length}`}
                        </button>
                    </div>
                    {bulkMessage ? <p className={`mt-2 text-sm ${bulkMessage.ok ? 'text-primary' : 'text-red-500'}`}>{bulkMessage.text}</p> : null}
                </section>
            ) : null}

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
                        <thead><tr className="text-xs text-muted-foreground"><th className="p-2">Guard</th><th className="p-2">MRP</th><th className="p-2">Discount</th><th className="p-2">Price</th><th className="p-2 text-center">In store</th><th className="p-2" /></tr></thead>
                        <tbody>{shown.map(guard => <GuardRow key={`${guard.id}-${guard.mrp}-${guard.price}-${guard.isActive}-${version}`} initial={guard} />)}</tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
