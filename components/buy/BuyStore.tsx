'use client';

// Buy refurbished: the devices on sale (filter by condition and brand), and ordering one with cash on delivery, as in
// the Customer app's Buy tab. The server prices the order and takes the device from stock.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Smartphone, Truck, X } from 'lucide-react';
import { placeRefurbishedOrder } from '@/actions/buyRepair';
import { DEVICE_GRADES, gradeLabel, inr, type DeviceGrade, type RefurbishedDevice, type RefurbishedOrder } from '@/lib/buyRepair';
import { discountPercent } from '@/lib/shop';
import { DeliveryFields, useDeliveryForm } from '@/components/ui/DeliveryFields';

const field = 'w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-primary';

function DevicePicture({ device, className }: { device: RefurbishedDevice; className: string }) {
    return device.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={device.imageUrl} alt={device.name} className={`${className} object-contain`} loading="lazy" />
    ) : (
        <div className={`${className} flex items-center justify-center text-muted-foreground`}><Smartphone className="h-10 w-10 opacity-50" /></div>
    );
}

export function BuyStore({ items, signedIn, defaultName }: { items: RefurbishedDevice[]; signedIn: boolean; defaultName: string }) {
    const [grade, setGrade] = useState<DeviceGrade | 'all'>('all');
    const [brand, setBrand] = useState('all');
    const [chosen, setChosen] = useState<RefurbishedDevice | null>(null);
    const brands = useMemo(() => [...new Set(items.map(i => i.brand))].sort(), [items]);
    const shown = items.filter(i => (grade === 'all' || i.grade === grade) && (brand === 'all' || i.brand === brand));

    return (
        <div className="mx-auto max-w-6xl px-4 py-10">
            <header className="mb-8">
                <h1 className="text-3xl font-black md:text-4xl">Buy refurbished</h1>
                <p className="mt-2 text-muted-foreground">Checked phones with a warranty, delivered to your door. Pay cash on delivery.</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Warranty on every device</span>
                    <span className="flex items-center gap-1.5"><Truck className="h-4 w-4 text-primary" /> Doorstep delivery</span>
                </div>
            </header>

            <div className="mb-6 flex flex-wrap items-center gap-2">
                {[{ id: 'all' as const, label: 'All conditions' }, ...DEVICE_GRADES].map(g => (
                    <button key={g.id} type="button" onClick={() => setGrade(g.id)}
                        className={`rounded-full border px-4 py-1.5 text-sm font-bold ${grade === g.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}>
                        {g.label}
                    </button>
                ))}
                {brands.length > 1 ? (
                    <select aria-label="Brand" value={brand} onChange={e => setBrand(e.target.value)} className="rounded-full border bg-card px-4 py-1.5 text-sm">
                        <option value="all">All brands</option>
                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                ) : null}
            </div>
            {grade !== 'all' ? <p className="-mt-3 mb-5 text-sm text-muted-foreground">{DEVICE_GRADES.find(g => g.id === grade)?.detail}</p> : null}

            {shown.length ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {shown.map(device => {
                        const off = discountPercent(device.mrp, device.price);
                        return (
                            <article key={device.id} className="flex flex-col rounded-2xl border bg-card p-4">
                                <div className="relative mb-3 rounded-xl bg-muted/40 p-3">
                                    <DevicePicture device={device} className="mx-auto h-48 w-full" />
                                    {off ? <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-0.5 text-xs font-black text-primary-foreground">{off}% off</span> : null}
                                </div>
                                <h2 className="font-bold leading-snug">{device.name}</h2>
                                <p className="text-sm text-muted-foreground">{device.storage} · {gradeLabel(device.grade)} · {device.warrantyMonths}-month warranty</p>
                                <p className="mt-2 text-xl font-black">{inr(device.price)} {off ? <span className="text-sm font-normal text-muted-foreground line-through">{inr(device.mrp)}</span> : null}</p>
                                <p className="text-xs text-muted-foreground">{device.stock <= 3 ? `Only ${device.stock} left` : 'In stock'}</p>
                                <button type="button" onClick={() => setChosen(device)} className="mt-4 rounded-full bg-primary py-2.5 font-bold text-primary-foreground hover:bg-primary/90">Buy now</button>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">No devices match. Try another condition or brand.</p>
            )}

            {chosen ? <Checkout device={chosen} signedIn={signedIn} defaultName={defaultName} onClose={() => setChosen(null)} /> : null}
        </div>
    );
}

function Checkout({ device, signedIn, defaultName, onClose }: { device: RefurbishedDevice; signedIn: boolean; defaultName: string; onClose: () => void }) {
    const delivery = useDeliveryForm(defaultName);
    const form = delivery.values;
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [placed, setPlaced] = useState<RefurbishedOrder | null>(null);

    const submit = async () => {
        if (!delivery.check()) return;
        setBusy(true);
        setError('');
        const result = await placeRefurbishedOrder({ deviceId: device.id, name: form.name.trim(), phone: form.phone, address: form.address.trim(), pincode: form.pincode });
        setBusy(false);
        if (result.ok) setPlaced(result.data ?? null);
        else setError(result.error);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Buy ${device.name}`}>
            <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border bg-background p-6 sm:rounded-3xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <DevicePicture device={device} className="h-16 w-14 shrink-0" />
                        <div>
                            <p className="font-bold">{device.name}</p>
                            <p className="text-sm text-muted-foreground">{device.storage} · {gradeLabel(device.grade)} · {inr(device.price)}</p>
                        </div>
                    </div>
                    <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
                </div>
                {placed ? (
                    <div className="py-6 text-center">
                        <h2 className="text-2xl font-black">Order placed</h2>
                        <p className="mt-2 text-muted-foreground">Order #{placed.orderNumber} · {inr(placed.price)} · cash on delivery. We&apos;ll call you before delivery.</p>
                        <Link href="/orders" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">See my orders</Link>
                    </div>
                ) : signedIn ? (
                    <div className="space-y-3">
                        <h2 className="font-bold">Delivery details</h2>
                        <DeliveryFields form={delivery} field={field} />
                        <div className="flex justify-between border-t pt-3 font-black"><span>To pay on delivery</span><span>{inr(device.price)}</span></div>
                        {error ? <p className="text-sm text-red-500">{error}</p> : null}
                        <button type="button" disabled={busy} onClick={submit} className="w-full rounded-full bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">
                            {busy ? 'Placing order…' : 'Place order · cash on delivery'}
                        </button>
                    </div>
                ) : (
                    <div className="py-4 text-center">
                        <p className="text-muted-foreground">Sign in to order this device.</p>
                        <Link href="/login" className="mt-4 inline-block rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Sign in to continue</Link>
                    </div>
                )}
            </div>
        </div>
    );
}
