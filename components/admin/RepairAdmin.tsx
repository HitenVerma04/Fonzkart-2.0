'use client';

// Repairs for administrators (the Admin app's "Repair prices" and "Repair bookings"): the switch that shows Repair to
// customers, the fixed price of each repair per phone, and the booked visits.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteRepairPrice, saveRepairPrice, setRepairBookingStatus, setRepairEnabled } from '@/actions/buyRepair';
import { REPAIR_ISSUES, REPAIR_SLOTS, REPAIR_STATUSES, inr, issueLabel, type RepairBooking, type RepairPrice, type RepairPriceInput, type RepairStatus } from '@/lib/buyRepair';

const field = 'w-full rounded-lg border bg-background px-3 py-2 text-sm';
const EMPTY: RepairPriceInput = { brand: '', model: '', issue: 'screen', price: 0, isActive: true };

export function RepairAdmin({ enabled: initialEnabled, items, bookings }: { enabled: boolean; items: RepairPrice[]; bookings: RepairBooking[] }) {
    const router = useRouter();
    const [enabled, setEnabled] = useState(initialEnabled);
    const [editing, setEditing] = useState<RepairPrice | 'new' | null>(null);
    const [form, setForm] = useState<RepairPriceInput>(EMPTY);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [tab, setTab] = useState<'prices' | 'bookings'>('prices');
    const [query, setQuery] = useState('');

    const phones = useMemo(() => {
        const q = query.trim().toLowerCase();
        const groups = new Map<string, RepairPrice[]>();
        for (const p of items) {
            const key = `${p.brand} ${p.model}`;
            if (q && !key.toLowerCase().includes(q)) continue;
            groups.set(key, [...(groups.get(key) ?? []), p]);
        }
        return [...groups.entries()];
    }, [items, query]);

    const open = (p: RepairPrice | 'new', preset?: Partial<RepairPriceInput>) => {
        setEditing(p);
        setMessage(null);
        setForm(p === 'new' ? { ...EMPTY, ...preset } : { brand: p.brand, model: p.model, issue: p.issue, price: p.price, isActive: p.isActive, displayOrder: p.displayOrder });
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

    const canSave = !!form.brand.trim() && !!form.model.trim() && form.price > 0;
    const save = () => {
        const input = { ...form, brand: form.brand.trim(), model: form.model.trim() };
        void run(() => saveRepairPrice(editing === 'new' || !editing ? null : editing.id, input),
            `${issueLabel(input.issue)} for ${input.brand} ${input.model} ${editing === 'new' ? 'added' : 'saved'}.`, () => setEditing(null));
    };

    return (
        <div className="space-y-6">
            <label className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4">
                <span>
                    <span className="block font-bold">Show Repair to customers</span>
                    <span className="block text-sm text-muted-foreground">Off: the website and the Customer app say doorstep repairs are coming soon, and take no bookings.</span>
                </span>
                <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={enabled} disabled={busy}
                    onChange={e => { const on = e.target.checked; setEnabled(on); void run(() => setRepairEnabled(on), on ? 'Repair is now shown to customers.' : 'Repair is now hidden from customers.'); }} />
            </label>

            <div className="flex gap-2">
                {(['prices', 'bookings'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full border px-4 py-1.5 text-sm font-bold ${tab === t ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}>
                        {t === 'prices' ? `Prices (${items.length})` : `Bookings (${bookings.length})`}
                    </button>
                ))}
            </div>
            {message ? <p className={`rounded-xl border px-4 py-2 text-sm ${message.ok ? 'border-primary/30 bg-primary/10 text-primary' : 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>{message.text}</p> : null}

            {tab === 'prices' ? (
                <>
                    {editing ? (
                        <section className="space-y-4 rounded-2xl border bg-card p-5">
                            <h2 className="text-lg font-bold">{editing === 'new' ? 'New repair price' : 'Edit repair price'}</h2>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <label className="text-sm">Phone brand<input className={field} maxLength={40} placeholder="e.g. Apple" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></label>
                                <label className="text-sm">Phone model<input className={field} maxLength={60} placeholder="e.g. iPhone 13" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></label>
                                <label className="text-sm">Price (₹)<input className={field} inputMode="numeric" value={form.price ? String(form.price) : ''} onChange={e => setForm({ ...form, price: Number(e.target.value.replace(/\D/g, '').slice(0, 6)) || 0 })} /></label>
                            </div>
                            <div>
                                <span className="text-sm font-semibold">Repair</span>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    {REPAIR_ISSUES.map(i => (
                                        <button key={i.id} type="button" title={i.detail} onClick={() => setForm({ ...form, issue: i.id })}
                                            className={`rounded-full border px-4 py-1.5 text-sm font-bold ${form.issue === i.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}`}>{i.label}</button>
                                    ))}
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Show to customers</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setEditing(null)} className="rounded-full border px-5 py-2 text-sm font-bold">Cancel</button>
                                <button type="button" disabled={!canSave || busy} onClick={save} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
                            </div>
                        </section>
                    ) : (
                        <div className="flex flex-wrap items-center gap-3">
                            <button type="button" onClick={() => open('new')} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">Add repair price</button>
                            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search phone" className="rounded-full border bg-background px-4 py-1.5 text-sm" />
                        </div>
                    )}

                    {phones.length ? (
                        <div className="grid gap-3">
                            {phones.map(([phone, prices]) => (
                                <article key={phone} className="rounded-2xl border bg-card p-4">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <h3 className="font-bold">{phone}</h3>
                                        <button type="button" className="text-sm font-bold text-primary hover:underline" onClick={() => open('new', { brand: prices[0].brand, model: prices[0].model })}>+ Add repair</button>
                                    </div>
                                    <ul className="divide-y">
                                        {prices.map(p => (
                                            <li key={p.id} className={`flex items-center justify-between gap-3 py-2 text-sm ${p.isActive ? '' : 'opacity-60'}`}>
                                                <span>{issueLabel(p.issue)}{p.isActive ? '' : ' · Hidden'}</span>
                                                <span className="flex items-center gap-4">
                                                    <b>{inr(p.price)}</b>
                                                    <button type="button" onClick={() => open(p)} className="font-bold text-primary hover:underline">Edit</button>
                                                    <button type="button" disabled={busy} className="font-bold text-red-500 hover:underline"
                                                        onClick={() => deleting === p.id ? void run(() => deleteRepairPrice(p.id), `${issueLabel(p.issue)} for ${phone} deleted.`, () => setDeleting(null)) : setDeleting(p.id)}>
                                                        {deleting === p.id ? 'Click again to delete' : 'Delete'}
                                                    </button>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </article>
                            ))}
                        </div>
                    ) : <p className="text-sm text-muted-foreground">{query ? 'No phone matches.' : 'No repair prices yet. Customers see an empty Repair page until you add one.'}</p>}
                </>
            ) : (
                bookings.length ? <div className="grid gap-3">{bookings.map(b => <Booking key={b.id} booking={b} />)}</div>
                    : <p className="text-sm text-muted-foreground">No repair bookings yet.</p>
            )}
        </div>
    );
}

function Booking({ booking }: { booking: RepairBooking }) {
    const [status, setStatus] = useState(booking.status);
    const [error, setError] = useState('');
    const change = async (next: RepairStatus) => {
        const previous = status;
        setStatus(next);
        setError('');
        const result = await setRepairBookingStatus(booking.id, next);
        if (!result.ok) {
            setStatus(previous);
            setError(result.error);
        }
    };
    return (
        <article className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-bold">Booking #{booking.bookingNumber} · {inr(booking.price)}</p>
                <select aria-label={`Status of booking ${booking.bookingNumber}`} value={status} onChange={e => change(e.target.value as RepairStatus)} className="rounded-lg border bg-background px-2 py-1 text-sm">
                    {REPAIR_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
            </div>
            <p className="mt-1 text-sm">{issueLabel(booking.issue)} · {booking.brand} {booking.model}</p>
            <p className="text-sm">
                Visit {new Date(`${booking.visitDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, {REPAIR_SLOTS.find(s => s.id === booking.slot)?.time ?? booking.slot}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{booking.name} · {booking.phone}{booking.customerEmail ? ` · ${booking.customerEmail}` : ''}</p>
            <p className="text-sm text-muted-foreground">{booking.address}, {booking.pincode}</p>
            {error ? <p className="mt-1 text-sm text-red-500">{error}</p> : null}
        </article>
    );
}
