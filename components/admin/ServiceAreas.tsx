'use client';

// Service areas for a partner (as in the Partner app): the pincodes they serve, and asking for more. A request goes to
// the admins and the partner's zonal head, who approve all or some of the pincodes.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { askForPincodes, cancelPincodeRequest } from '@/actions/buyRepair';
import type { MyPincodes, PincodeRequestItem } from '@/lib/buyRepair';

const STATUS: Record<PincodeRequestItem['status'], { label: string; className: string }> = {
    PENDING: { label: 'Waiting for approval', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
    APPROVED: { label: 'Approved', className: 'bg-primary/10 text-primary' },
    REJECTED: { label: 'Not approved', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
    CANCELLED: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
};

export function ServiceAreas({ data }: { data: MyPincodes }) {
    const router = useRouter();
    const { pincodes, city, requests } = data;
    const [chosen, setChosen] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const [note, setNote] = useState('');
    const [inputError, setInputError] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [cancelling, setCancelling] = useState<string | null>(null);

    const { mine, waiting, suggestions } = useMemo(() => {
        const own = new Set(pincodes);
        const pending = new Set(requests.filter(r => r.status === 'PENDING').flatMap(r => r.pincodes));
        return { mine: own, waiting: pending, suggestions: (city?.pincodes ?? []).filter(p => !own.has(p) && !pending.has(p)) };
    }, [pincodes, city, requests]);

    const toggle = (code: string) => setChosen(now => now.includes(code) ? now.filter(c => c !== code) : [...now, code]);

    const addTyped = () => {
        const codes = input.split(/[\s,]+/).filter(Boolean);
        if (!codes.length) return;
        const bad = codes.find(c => !/^\d{6}$/.test(c));
        if (bad) return setInputError(`"${bad}" is not a 6-digit pincode.`);
        const served = codes.find(c => mine.has(c));
        if (served) return setInputError(`You already serve ${served}.`);
        const pending = codes.find(c => waiting.has(c));
        if (pending) return setInputError(`${pending} is already waiting for approval.`);
        setInputError('');
        setChosen(now => [...new Set([...now, ...codes])]);
        setInput('');
    };

    const send = async () => {
        setBusy(true);
        setMessage(null);
        const result = await askForPincodes(chosen, note.trim());
        setBusy(false);
        if (!result.ok) setMessage({ ok: false, text: result.error });
        else {
            setMessage({ ok: true, text: `Request sent for ${chosen.length} pincode${chosen.length === 1 ? '' : 's'}. You'll get a notification when it's decided.` });
            setChosen([]);
            setNote('');
            router.refresh();
        }
    };

    const cancel = async (id: string) => {
        if (cancelling !== id) return setCancelling(id);
        setCancelling(null);
        const result = await cancelPincodeRequest(id);
        setMessage(result.ok ? { ok: true, text: 'Request cancelled.' } : { ok: false, text: result.error });
        router.refresh();
    };

    const allSuggested = suggestions.length > 0 && suggestions.every(s => chosen.includes(s));

    return (
        <div className="space-y-6">
            {message ? <p className={`rounded-xl border px-4 py-2 text-sm ${message.ok ? 'border-primary/30 bg-primary/10 text-primary' : 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>{message.text}</p> : null}

            <section className="rounded-2xl border bg-card p-5">
                <h2 className="text-lg font-bold">You serve {pincodes.length} pincode{pincodes.length === 1 ? '' : 's'}</h2>
                <p className="text-sm text-muted-foreground">{city ? `City: ${city.name}. ` : 'No city assigned yet. '}New orders in these pincodes come to you.</p>
                {pincodes.length ? (
                    <div className="mt-3 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
                        {pincodes.map(p => <span key={p} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold">{p}</span>)}
                    </div>
                ) : <p className="mt-2 text-sm text-muted-foreground">None yet. Ask for the pincodes you can cover below.</p>}
            </section>

            <section className="space-y-4 rounded-2xl border bg-card p-5">
                <div>
                    <h2 className="text-lg font-bold">Ask for more pincodes</h2>
                    <p className="text-sm text-muted-foreground">Pick or type the pincodes you can cover. An admin approves them, usually within a day.</p>
                </div>
                <div className="flex gap-2">
                    <input value={input} onChange={e => { setInput(e.target.value.replace(/[^\d,\s]/g, '')); setInputError(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTyped(); } }}
                        placeholder="Type pincodes, e.g. 560032, 560034" className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
                    <button type="button" onClick={addTyped} className="rounded-lg border border-primary bg-primary/10 px-4 text-sm font-bold text-primary">+ Add</button>
                </div>
                {inputError ? <p className="text-sm text-red-500">{inputError}</p> : null}

                {suggestions.length ? (
                    <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-sm font-bold">{city?.name} pincodes you don&apos;t serve ({suggestions.length})</span>
                            <button type="button" className="text-sm font-bold text-primary"
                                onClick={() => setChosen(now => allSuggested ? now.filter(c => !suggestions.includes(c)) : [...new Set([...now, ...suggestions])])}>
                                {allSuggested ? 'Clear' : 'Select all'}
                            </button>
                        </div>
                        <div className="flex max-h-52 flex-wrap gap-1.5 overflow-y-auto">
                            {suggestions.map(code => {
                                const on = chosen.includes(code);
                                return (
                                    <button key={code} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(code)}
                                        className={`rounded-full border px-3 py-1 text-sm font-bold ${on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}`}>{on ? '✓ ' : ''}{code}</button>
                                );
                            })}
                        </div>
                    </div>
                ) : null}

                {chosen.length ? (
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-bold">In this request ({chosen.length})</span>
                            <button type="button" onClick={() => setChosen([])} className="text-sm font-bold text-red-500">Remove all</button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {chosen.map(code => <button key={code} type="button" onClick={() => toggle(code)} aria-label={`Remove ${code}`} className="rounded-full border border-primary bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">{code} ×</button>)}
                        </div>
                    </div>
                ) : null}

                <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Note for the admin (optional): areas, team size, timings"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                <button type="button" disabled={!chosen.length || busy} onClick={send} className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
                    {busy ? 'Sending…' : chosen.length ? `Send request (${chosen.length})` : 'Send request'}
                </button>
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-bold">Your requests</h2>
                {requests.length ? requests.map(r => {
                    const left = r.status === 'APPROVED' ? r.pincodes.filter(p => !r.approved.includes(p)) : [];
                    return (
                        <article key={r.id} className="space-y-1.5 rounded-2xl border bg-card p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${STATUS[r.status].className}`}>{STATUS[r.status].label}</span>
                                <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</span>
                            </div>
                            <p className="font-bold">{r.pincodes.join(', ')}</p>
                            {r.note ? <p className="text-sm text-muted-foreground">Your note: {r.note}</p> : null}
                            {left.length ? <p className="text-sm text-muted-foreground">Approved {r.approved.length}; not approved: {left.join(', ')}</p> : null}
                            {r.reviewNote ? <p className="text-sm text-muted-foreground">Admin: {r.reviewNote}</p> : null}
                            {r.status === 'PENDING' ? (
                                <button type="button" onClick={() => cancel(r.id)} className="text-sm font-bold text-red-500">{cancelling === r.id ? 'Click again to cancel the request' : 'Cancel request'}</button>
                            ) : null}
                        </article>
                    );
                }) : <p className="text-sm text-muted-foreground">No requests yet.</p>}
            </section>
        </div>
    );
}
