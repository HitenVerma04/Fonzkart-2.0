'use client';

// Refurbished devices for administrators (the Admin app's "Refurbished devices" and "Device orders"): the switch that
// shows Buy to customers, the listings (name, brand, storage, condition, warranty, phone photo, prices, stock) and
// the orders. The discount can be typed as a sale price or as a percent off the MRP.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone } from 'lucide-react';
import { deleteRefurbishedDevice, saveRefurbishedDevice, setBuyEnabled, setRefurbishedOrderStatus } from '@/actions/buyRepair';
import { PictureField } from '@/components/admin/PictureField';
import { DEVICE_GRADES, gradeLabel, inr, type RefurbishedDevice, type RefurbishedDeviceInput, type RefurbishedOrder } from '@/lib/buyRepair';
import { SHOP_ORDER_STATUSES, discountPercent, type ShopOrderStatus } from '@/lib/shop';

const field = 'w-full rounded-lg border bg-background px-3 py-2 text-sm';
const EMPTY: RefurbishedDeviceInput = { name: '', brand: '', storage: '', grade: 'good', warrantyMonths: 6, imageUrl: null, mrp: 0, price: 0, stock: 1, isActive: true };
const digits = (text: string, max: number) => Number(text.replace(/\D/g, '').slice(0, max)) || 0;
const priceFor = (mrp: number, percent: number) => Math.max(1, Math.floor((mrp * (100 - Math.min(Math.max(percent, 0), 99))) / 100));

export function RefurbishedAdmin({ enabled: initialEnabled, items, orders }: { enabled: boolean; items: RefurbishedDevice[]; orders: RefurbishedOrder[] }) {
    const router = useRouter();
    const [enabled, setEnabled] = useState(initialEnabled);
    const [editing, setEditing] = useState<RefurbishedDevice | 'new' | null>(null);
    const [form, setForm] = useState<RefurbishedDeviceInput>(EMPTY);
    const [pctText, setPctText] = useState('');
    const [deleting, setDeleting] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [tab, setTab] = useState<'devices' | 'orders'>('devices');

    const open = (d: RefurbishedDevice | 'new') => {
        setEditing(d);
        setMessage(null);
        setPctText('');
        if (d === 'new') setForm(EMPTY);
        else {
            const { id: _id, displayOrder: _order, ...input } = d;
            setForm({ ...input, displayOrder: d.displayOrder });
        }
    };

    const run = async (task: () => Promise<{ ok: boolean; error?: string }>, done: string, after?: () => void) => {
        setBusy(true);
        setMessage(null);
        const result = await task();
        setBusy(false);
        if (!result.ok) setMessage({ ok: false, text: result.error ?? 'Something went wrong.' });
        else {
            setMessage({ ok: true, text: done });
            after?.();
            router.refresh();
        }
    };

    const off = discountPercent(form.mrp, form.price);
    const priceProblem = form.mrp <= 0 ? 'Enter the MRP.' : form.price <= 0 ? 'Enter the sale price.' : form.price > form.mrp ? 'The sale price cannot be more than the MRP.' : '';
    const canSave = !!form.name.trim() && !!form.brand.trim() && !!form.storage.trim() && !priceProblem;

    const save = () => {
        const input = { ...form, name: form.name.trim(), brand: form.brand.trim(), storage: form.storage.trim(), imageUrl: form.imageUrl?.trim() || null };
        void run(() => saveRefurbishedDevice(editing === 'new' || !editing ? null : editing.id, input), `"${input.name}" ${editing === 'new' ? 'added' : 'saved'}.`, () => setEditing(null));
    };

    return (
        <div className="space-y-6">
            <label className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4">
                <span>
                    <span className="block font-bold">Show Buy to customers</span>
                    <span className="block text-sm text-muted-foreground">Off: the website and the Customer app say refurbished phones are on their way, and take no orders.</span>
                </span>
                <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={enabled} disabled={busy}
                    onChange={e => { const on = e.target.checked; setEnabled(on); void run(() => setBuyEnabled(on), on ? 'Buy is now shown to customers.' : 'Buy is now hidden from customers.'); }} />
            </label>

            <div className="flex gap-2">
                {(['devices', 'orders'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full border px-4 py-1.5 text-sm font-bold ${tab === t ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}>
                        {t === 'devices' ? `Devices (${items.length})` : `Orders (${orders.length})`}
                    </button>
                ))}
            </div>
            {message ? <p className={`rounded-xl border px-4 py-2 text-sm ${message.ok ? 'border-primary/30 bg-primary/10 text-primary' : 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>{message.text}</p> : null}

            {tab === 'devices' ? (
                <>
                    {editing ? (
                        <section className="space-y-4 rounded-2xl border bg-card p-5">
                            <h2 className="text-lg font-bold">{editing === 'new' ? 'New device' : 'Edit device'}</h2>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <label className="text-sm sm:col-span-3">Name<input className={field} maxLength={80} placeholder="e.g. iPhone 13" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
                                <label className="text-sm">Brand<input className={field} maxLength={40} placeholder="e.g. Apple" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></label>
                                <label className="text-sm">Storage<input className={field} maxLength={40} placeholder="e.g. 128 GB" value={form.storage} onChange={e => setForm({ ...form, storage: e.target.value })} /></label>
                                <label className="text-sm">Warranty (months)<input className={field} inputMode="numeric" value={String(form.warrantyMonths)} onChange={e => setForm({ ...form, warrantyMonths: digits(e.target.value, 2) })} /></label>
                            </div>
                            <div>
                                <span className="text-sm font-semibold">Condition</span>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    {DEVICE_GRADES.map(g => (
                                        <button key={g.id} type="button" title={g.detail} onClick={() => setForm({ ...form, grade: g.id })}
                                            className={`rounded-full border px-4 py-1.5 text-sm font-bold ${form.grade === g.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}`}>{g.label}</button>
                                    ))}
                                </div>
                            </div>
                            <PictureField label="Phone photo" value={form.imageUrl ?? ''} onChange={url => setForm({ ...form, imageUrl: url || null })}
                                hint={'Portrait, the whole phone in view, on a white or transparent background (PNG).\nAt least 800 × 1000 px: small photos look blurry on the device page.\nJPG, PNG or WebP, up to 10 MB.'} />
                            <div className="grid gap-3 sm:grid-cols-4">
                                <label className="text-sm">MRP (₹)<input className={field} inputMode="numeric" value={form.mrp ? String(form.mrp) : ''}
                                    onChange={e => { const mrp = digits(e.target.value, 7); setForm({ ...form, mrp, price: pctText !== '' ? priceFor(mrp, Number(pctText)) : form.price }); }} /></label>
                                <label className="text-sm">Discount (%)<input className={field} inputMode="numeric" value={pctText !== '' ? pctText : off ? String(off) : ''} placeholder="0"
                                    onChange={e => { const t = e.target.value.replace(/\D/g, '').slice(-2); setPctText(t); setForm({ ...form, price: t === '' ? form.mrp : priceFor(form.mrp, Number(t)) }); }} /></label>
                                <label className="text-sm">Sale price (₹)<input className={field} inputMode="numeric" value={form.price ? String(form.price) : ''}
                                    onChange={e => { setPctText(''); setForm({ ...form, price: digits(e.target.value, 7) }); }} /></label>
                                <label className="text-sm">Stock<input className={field} inputMode="numeric" value={String(form.stock)} onChange={e => setForm({ ...form, stock: digits(e.target.value, 4) })} /></label>
                            </div>
                            {priceProblem && (form.mrp || form.price) ? <p className="text-sm text-red-500">{priceProblem}</p>
                                : !priceProblem ? <p className="text-sm"><b>{inr(form.price)}</b> {off ? <><span className="text-muted-foreground line-through">{inr(form.mrp)}</span> <span className="font-bold text-primary">{off}% off</span></> : <span className="text-muted-foreground">No discount</span>}</p> : null}
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Show to customers</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setEditing(null)} className="rounded-full border px-5 py-2 text-sm font-bold">Cancel</button>
                                <button type="button" disabled={!canSave || busy} onClick={save} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
                            </div>
                        </section>
                    ) : (
                        <button type="button" onClick={() => open('new')} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">Add device</button>
                    )}

                    {items.length ? (
                        <div className="grid gap-3">
                            {items.map(d => {
                                const pct = discountPercent(d.mrp, d.price);
                                return (
                                    <article key={d.id} className={`flex items-center gap-4 rounded-2xl border bg-card p-3 ${d.isActive ? '' : 'opacity-60'}`}>
                                        <div className="flex h-[76px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/40">
                                            {d.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={d.imageUrl} alt={d.name} className="h-[72px] w-14 object-contain" />
                                            ) : <Smartphone className="h-6 w-6 text-muted-foreground opacity-50" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold">{d.name}</p>
                                            <p className="text-sm text-muted-foreground">{d.brand} · {d.storage} · {gradeLabel(d.grade)}</p>
                                            <p className="text-sm font-black text-primary">{inr(d.price)} <span className="font-normal text-muted-foreground">MRP {inr(d.mrp)}{pct ? ` · ${pct}% off` : ''}</span></p>
                                            <p className="text-xs text-muted-foreground">{d.stock ? `${d.stock} in stock` : 'Sold out'}{d.isActive ? '' : ' · Hidden'}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 text-sm font-bold">
                                            <button type="button" onClick={() => open(d)} className="text-primary hover:underline">Edit</button>
                                            <button type="button" disabled={busy} className="text-red-500 hover:underline"
                                                onClick={() => deleting === d.id ? void run(() => deleteRefurbishedDevice(d.id), `"${d.name}" deleted.`, () => setDeleting(null)) : setDeleting(d.id)}>
                                                {deleting === d.id ? 'Click again to delete' : 'Delete'}
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    ) : <p className="text-sm text-muted-foreground">No devices yet. Customers see an empty Buy page until you add one.</p>}
                </>
            ) : (
                orders.length ? (
                    <div className="grid gap-3">
                        {orders.map(o => <DeviceOrder key={o.id} order={o} />)}
                    </div>
                ) : <p className="text-sm text-muted-foreground">No device orders yet.</p>
            )}
        </div>
    );
}

function DeviceOrder({ order }: { order: RefurbishedOrder }) {
    const [status, setStatus] = useState(order.status);
    const [error, setError] = useState('');
    const change = async (next: ShopOrderStatus) => {
        const previous = status;
        setStatus(next);
        setError('');
        const result = await setRefurbishedOrderStatus(order.id, next);
        if (!result.ok) {
            setStatus(previous);
            setError(result.error);
        }
    };
    return (
        <article className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-bold">Order #{order.orderNumber} · {inr(order.price)}</p>
                <select aria-label={`Status of order ${order.orderNumber}`} value={status} onChange={e => change(e.target.value as ShopOrderStatus)} className="rounded-lg border bg-background px-2 py-1 text-sm">
                    {SHOP_ORDER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
            </div>
            <p className="mt-1 text-sm">{order.deviceName} · {order.storage} · {gradeLabel(order.grade)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{order.name} · {order.phone}{order.customerEmail ? ` · ${order.customerEmail}` : ''}</p>
            <p className="text-sm text-muted-foreground">{order.address}, {order.pincode}</p>
            {error ? <p className="mt-1 text-sm text-red-500">{error}</p> : null}
        </article>
    );
}
