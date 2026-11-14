'use client';

// Doorstep repair: choose the phone (brand, model) and what is wrong, see the fixed price, pick a day and time, and
// book, as in the Customer app's Repair tab. The server takes the price from its own list.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Clock, ShieldCheck, Wrench } from 'lucide-react';
import { bookRepair } from '@/actions/buyRepair';
import { REPAIR_ISSUES, REPAIR_SLOTS, inr, issueLabel, type RepairBooking, type RepairPrice, type RepairSlot } from '@/lib/buyRepair';

const field = 'w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-primary';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHOWN = 7;
const pad = (n: number) => String(n).padStart(2, '0');

/** The days a visit can be booked for, from tomorrow (as in the app), counted from today's date in India, so the server
 *  and the browser list the same days. */
function visitDays() {
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    return Array.from({ length: DAYS_SHOWN }, (_, i) => {
        const day = new Date(today);
        day.setDate(today.getDate() + i + 1);
        return {
            id: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`,
            label: i === 0 ? 'Tomorrow' : WEEKDAYS[day.getDay()],
            caption: `${day.getDate()} ${MONTHS[day.getMonth()]}`,
        };
    });
}

const chip = (on: boolean) => `rounded-xl border px-3 py-2 text-left text-sm ${on ? 'border-primary bg-primary/10 font-bold text-primary' : 'bg-card hover:border-primary/50'}`;

export function RepairBooker({ items, signedIn, defaultName }: { items: RepairPrice[]; signedIn: boolean; defaultName: string }) {
    const brands = useMemo(() => [...new Set(items.map(i => i.brand))].sort(), [items]);
    const [brand, setBrand] = useState(brands.length === 1 ? brands[0] : '');
    const models = useMemo(() => [...new Set(items.filter(i => i.brand === brand).map(i => i.model))].sort(), [items, brand]);
    const [model, setModel] = useState('');
    const prices = items.filter(i => i.brand === brand && i.model === model);
    const [priceId, setPriceId] = useState('');
    const chosen = prices.find(p => p.id === priceId) ?? null;
    const days = useMemo(visitDays, []);
    const [date, setDate] = useState('');
    const [slot, setSlot] = useState<RepairSlot | ''>('');
    const [form, setForm] = useState({ name: defaultName, phone: '', address: '', pincode: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [booked, setBooked] = useState<RepairBooking | null>(null);
    const problem = !chosen ? 'Choose your phone and the repair.' : !date || !slot ? 'Choose a day and a time.'
        : form.name.trim().length < 2 ? 'Enter your name.' : !/^\d{10}$/.test(form.phone) ? 'Enter your 10-digit mobile number.'
        : form.address.trim().length < 6 ? 'Enter your full address.' : !/^\d{6}$/.test(form.pincode) ? 'Enter your 6-digit pincode.' : '';

    const submit = async () => {
        if (!chosen || !slot) return;
        setBusy(true);
        setError('');
        const result = await bookRepair({ repairPriceId: chosen.id, visitDate: date, slot, name: form.name.trim(), phone: form.phone, address: form.address.trim(), pincode: form.pincode });
        setBusy(false);
        if (result.ok) setBooked(result.data ?? null);
        else setError(result.error);
    };

    if (booked) {
        return (
            <div className="mx-auto max-w-xl px-4 py-16 text-center">
                <h1 className="text-3xl font-black">Repair booked</h1>
                <p className="mt-2 text-muted-foreground">
                    Booking #{booked.bookingNumber} · {issueLabel(booked.issue)} for {booked.brand} {booked.model} · {inr(booked.price)}, pay after the repair.
                </p>
                <Link href="/orders" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">See my bookings</Link>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl px-4 py-10">
            <header className="mb-8">
                <h1 className="text-3xl font-black md:text-4xl">Doorstep repair</h1>
                <p className="mt-2 text-muted-foreground">Fixed prices, repaired at your home or office. Pay after the repair.</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Wrench className="h-4 w-4 text-primary" /> Trained technicians</span>
                    <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Quality parts</span>
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" /> Pick your time</span>
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                <div className="space-y-6">
                    <section className="rounded-2xl border bg-card p-5">
                        <h2 className="mb-3 font-bold">1. Your phone</h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <select aria-label="Brand" className={field} value={brand} onChange={e => { setBrand(e.target.value); setModel(''); setPriceId(''); }}>
                                <option value="">Choose brand</option>
                                {brands.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            <select aria-label="Model" className={field} value={model} disabled={!brand} onChange={e => { setModel(e.target.value); setPriceId(''); }}>
                                <option value="">{brand ? 'Choose model' : 'Choose a brand first'}</option>
                                {models.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </section>

                    {model ? (
                        <section className="rounded-2xl border bg-card p-5">
                            <h2 className="mb-3 font-bold">2. What needs fixing</h2>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {prices.map(p => {
                                    const issue = REPAIR_ISSUES.find(i => i.id === p.issue);
                                    return (
                                        <button key={p.id} type="button" onClick={() => setPriceId(p.id)} className={chip(priceId === p.id)}>
                                            <span className="flex justify-between gap-2"><span>{issue?.label ?? p.issue}</span><span className="font-black">{inr(p.price)}</span></span>
                                            <span className="block text-xs font-normal text-muted-foreground">{issue?.detail}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    ) : null}

                    {chosen ? (
                        <section className="rounded-2xl border bg-card p-5">
                            <h2 className="mb-3 font-bold">3. When should we come?</h2>
                            <div className="flex flex-wrap gap-2">
                                {days.map(d => (
                                    <button key={d.id} type="button" onClick={() => setDate(d.id)} className={chip(date === d.id)}>
                                        <span className="block">{d.label}</span><span className="block text-xs text-muted-foreground">{d.caption}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {REPAIR_SLOTS.map(s => (
                                    <button key={s.id} type="button" onClick={() => setSlot(s.id)} className={chip(slot === s.id)}>
                                        <span className="block">{s.label}</span><span className="block text-xs text-muted-foreground">{s.time}</span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </div>

                <aside className="h-fit space-y-3 rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
                    <h2 className="font-bold">Your visit</h2>
                    {chosen ? (
                        <p className="text-sm">{issueLabel(chosen.issue)} · {brand} {model}</p>
                    ) : <p className="text-sm text-muted-foreground">Choose your phone and the repair to see the price.</p>}
                    {signedIn ? (
                        <>
                            <input className={field} placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            <input className={field} placeholder="10-digit mobile number" inputMode="numeric" maxLength={10} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} />
                            <textarea className={field} placeholder="Full address" rows={3} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                            <input className={field} placeholder="6-digit pincode" inputMode="numeric" maxLength={6} value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '') })} />
                        </>
                    ) : <p className="text-sm text-muted-foreground">Sign in to book a visit.</p>}
                    {chosen ? <div className="flex justify-between border-t pt-3 font-black"><span>Pay after the repair</span><span>{inr(chosen.price)}</span></div> : null}
                    {error ? <p className="text-sm text-red-500">{error}</p> : null}
                    {signedIn ? (
                        <>
                            <button type="button" disabled={!!problem || busy} onClick={submit} className="w-full rounded-full bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">
                                {busy ? 'Booking…' : 'Book the visit'}
                            </button>
                            {problem ? <p className="text-center text-xs text-muted-foreground">{problem}</p> : null}
                        </>
                    ) : (
                        <Link href="/login" className="block w-full rounded-full bg-primary py-3 text-center font-bold text-primary-foreground">Sign in to continue</Link>
                    )}
                </aside>
            </div>
        </div>
    );
}
