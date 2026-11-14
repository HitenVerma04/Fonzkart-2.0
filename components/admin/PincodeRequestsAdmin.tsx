'use client';

// Pincode requests (as in the Admin app): partners asking to serve more pincodes. Admins, and zonal heads for the
// partners in their cities, approve all or some of the pincodes (click one to leave it out) or reject with a reason.
// Approving adds them to the partner, and to its city's list when missing; the partner is notified either way.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { approvePincodeRequest, rejectPincodeRequest } from '@/actions/buyRepair';
import type { PincodeRequestForReview } from '@/lib/buyRepair';

const STATUS_LABEL: Record<string, string> = { APPROVED: 'Approved', REJECTED: 'Rejected', CANCELLED: 'Cancelled by partner', PENDING: 'Waiting' };
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export function PincodeRequestsAdmin({ tab, requests, pendingCount }: { tab: 'pending' | 'decided'; requests: PincodeRequestForReview[]; pendingCount: number }) {
    const router = useRouter();
    const [leftOut, setLeftOut] = useState<Record<string, string[]>>({});
    const [rejecting, setRejecting] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const act = async (id: string, task: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
        setBusy(id);
        setMessage(null);
        const result = await task();
        setBusy(null);
        if (!result.ok) setMessage({ ok: false, text: result.error ?? 'Something went wrong.' });
        else {
            setMessage({ ok: true, text: done });
            setRejecting(null);
            setReason('');
            router.refresh();
        }
    };

    const toggle = (id: string, code: string) => setLeftOut(now => {
        const off = now[id] ?? [];
        return { ...now, [id]: off.includes(code) ? off.filter(c => c !== code) : [...off, code] };
    });

    return (
        <div className="space-y-5">
            <div className="flex gap-2">
                <Link href="/admin/pincode-requests" className={`rounded-full border px-4 py-1.5 text-sm font-bold ${tab === 'pending' ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}>Waiting ({pendingCount})</Link>
                <Link href="/admin/pincode-requests?status=decided" className={`rounded-full border px-4 py-1.5 text-sm font-bold ${tab === 'decided' ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}>Decided</Link>
            </div>
            {tab === 'pending' ? <p className="text-sm text-muted-foreground">Click a pincode to leave it out, then approve the rest. Approved pincodes start getting this partner&apos;s new orders straight away.</p> : null}
            {message ? <p className={`rounded-xl border px-4 py-2 text-sm ${message.ok ? 'border-primary/30 bg-primary/10 text-primary' : 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>{message.text}</p> : null}

            {requests.length ? requests.map(r => {
                const off = leftOut[r.id] ?? [];
                const chosen = r.pincodes.filter(p => !off.includes(p));
                const served = new Set(r.partner?.pincodes ?? []);
                const onCity = new Set(r.city?.pincodes ?? []);
                const partnerName = r.partner?.name ?? 'Partner removed';
                return (
                    <article key={r.id} className="space-y-3 rounded-2xl border bg-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-bold">{partnerName}</p>
                            <span className="text-xs text-muted-foreground">{when(r.createdAt)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{[r.city?.name ?? 'No city', r.partner?.phone ?? r.partner?.email, `serves ${r.partner?.pincodes.length ?? 0} now`].filter(Boolean).join(' · ')}</p>
                        {r.note ? <p className="text-sm italic">“{r.note}”</p> : null}
                        {r.status === 'PENDING' ? (
                            <>
                                <p className="text-sm font-bold">Asks for {r.pincodes.length} · approving {chosen.length}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {r.pincodes.map(code => {
                                        const on = !off.includes(code);
                                        const tag = served.has(code) ? ' (has it)' : r.city && !onCity.has(code) ? ' (new to city)' : '';
                                        return (
                                            <button key={code} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(r.id, code)}
                                                className={`rounded-full border px-3 py-1 text-sm font-bold ${on ? (tag.includes('new') ? 'border-amber-600 bg-amber-600 text-white' : 'border-primary bg-primary text-primary-foreground') : 'bg-background text-muted-foreground line-through'}`}>
                                                {on ? '✓ ' : ''}{code}{tag}
                                            </button>
                                        );
                                    })}
                                </div>
                                {r.city && r.pincodes.some(p => !onCity.has(p)) ? <p className="text-xs text-muted-foreground">“New to city” pincodes are not on {r.city.name}&apos;s list yet; approving adds them to it.</p> : null}
                                {rejecting === r.id ? (
                                    <div className="space-y-2 rounded-xl border p-3">
                                        <label className="block text-sm">Reason (optional, the partner sees it)
                                            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Another partner already covers these areas" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                                        </label>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => setRejecting(null)} className="rounded-full border px-4 py-1.5 text-sm font-bold">Back</button>
                                            <button type="button" disabled={busy !== null} onClick={() => act(r.id, () => rejectPincodeRequest(r.id, reason), `Request from ${partnerName} rejected.`)}
                                                className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50">{busy === r.id ? 'Rejecting…' : 'Reject request'}</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <button type="button" disabled={busy !== null} onClick={() => setRejecting(r.id)} className="rounded-full border px-5 py-2 text-sm font-bold">Reject</button>
                                        <button type="button" disabled={!chosen.length || busy !== null}
                                            onClick={() => act(r.id, () => approvePincodeRequest(r.id, chosen), `${partnerName} now serves ${chosen.length} more pincode${chosen.length === 1 ? '' : 's'}.`)}
                                            className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                                            {busy === r.id ? 'Approving…' : chosen.length === r.pincodes.length ? 'Approve all' : `Approve ${chosen.length}`}
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <p className={`text-sm font-bold ${r.status === 'APPROVED' ? 'text-primary' : 'text-red-500'}`}>{STATUS_LABEL[r.status] ?? r.status}{r.reviewedAt ? ` · ${when(r.reviewedAt)}` : ''}</p>
                                <p className="text-sm">Asked: {r.pincodes.join(', ')}</p>
                                {r.status === 'APPROVED' ? <p className="text-sm">Approved: {r.approved.join(', ')}</p> : null}
                                {r.reviewNote ? <p className="text-sm text-muted-foreground">Note: {r.reviewNote}</p> : null}
                            </>
                        )}
                    </article>
                );
            }) : <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">{tab === 'pending' ? 'No requests waiting. Partners ask for pincodes from the Partner app or the website.' : 'Nothing decided yet.'}</p>}
        </div>
    );
}
