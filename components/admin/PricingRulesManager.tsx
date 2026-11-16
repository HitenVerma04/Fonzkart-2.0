'use client';

// Condition pricing for a category (as in the Admin app's Pricing screen): how offers are worked out, the lowest
// offer, and the share of the max value each answer takes. An answer takes its built-in share (from the backend) until
// an admin saves a rule for it; "Use built-in" removes the rule. Offers are only calculated on the backend, so a change
// applies at once to every quote on the website and in the apps.
import { useEffect, useMemo, useState } from 'react';
import { questionnaireSteps } from '@/lib/data';
import { deleteEvaluationRule, savePricingMinOffer, suggestMaxValue, upsertEvaluationRule, type PricingSettings } from '@/actions/admin';
import { Loader2, RotateCcw, Save } from 'lucide-react';

interface Rule { questionKey: string; answerKey: string; label?: string; deductionAmount: number; deductionPercent: number }
interface Row { questionKey: string; answerKey: string; questionLabel: string; answerLabel: string }
type Message = { ok: boolean; text: string };

const MAX_SHARE = 90;
const HOW_IT_WORKS = [
    "A variant's max value is what a flawless device that works fully, with box and bill, gets. With a launch price it is kept current every month (Admin app → Pricing engine).",
    "Repairs (cracked screen, dead camera, faulty port...) cost what that part costs for that model: official price lists, the repair price list and what resales taught, else the part's usual share of the launch price.",
    'Everything else (scratches, age, accessories, bought abroad) takes a share of the max value: its built-in share, or your rule once you save one.',
    'A rule for a repair answer is the least it takes: when the part costs more for a model, the repair cost is used.',
    'Answers on the same part are paid once; shares overlap and multiply. The offer never goes below the lowest offer or above the max value.',
];
const EXTRA_LABELS: Record<string, string> = {
    battery_health_low: 'Battery Health < 85% (iPhone)',
    battery_health_high: 'Battery Health > 85% (iPhone)',
};

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
/** The questionnaire a sell category asks (TVs and smartwatches are stored under other names). */
const questionnaireKey = (category: string) => (category === 'smarttv' ? 'tv' : category === 'smartwatch' ? 'watch' : category);
const isAccessory = (groupId: string, optionId: string) => groupId === 'accessories' || ['charger', 'box', 'bill'].includes(optionId);

/** One row per answer that can lower the price, keyed as the backend reads the answers. */
function ruleRows(category: string, builtIn: PricingSettings['defaults']): Row[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const steps: any[] = (questionnaireSteps as any)[questionnaireKey(category)] ?? [];
    const rows: Row[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addOptions = (groupId: string, questionLabel: string, options: any[] = []) => {
        for (const opt of options) {
            const missing = isAccessory(groupId, opt.id);
            rows.push({ questionKey: groupId, answerKey: missing ? `!${opt.id}` : opt.id, questionLabel, answerLabel: missing ? `Missing ${opt.label}` : opt.label });
        }
    };
    for (const step of steps) {
        for (const q of step.questions ?? []) {
            const badIsYes = builtIn.some(b => b.questionKey === q.id && b.answerKey === 'true');
            rows.push({ questionKey: q.id, answerKey: badIsYes ? 'true' : 'false', questionLabel: q.text, answerLabel: badIsYes ? 'Yes' : 'Defective / No' });
        }
        addOptions(step.id, step.title, step.options);
        if (step.type === 'combined-step') {
            for (const section of step.sections ?? []) addOptions(section.id, `${step.title} - ${section.title}`, section.options);
        }
    }
    for (const b of builtIn) {
        if (rows.some(r => r.questionKey === b.questionKey && r.answerKey === b.answerKey)) continue;
        const at = rows.map(r => r.questionKey).lastIndexOf(b.questionKey);
        if (at < 0) continue;
        rows.splice(at + 1, 0, { questionKey: b.questionKey, answerKey: b.answerKey, questionLabel: rows[at].questionLabel, answerLabel: EXTRA_LABELS[b.answerKey] ?? b.answerKey });
    }
    return rows;
}

export default function PricingRulesManager({ category, initialRules, pricing }: { category: string; initialRules: Rule[]; pricing: PricingSettings | null }) {
    const [rules, setRules] = useState<Rule[]>(initialRules);
    const [message, setMessage] = useState<Message | null>(null);
    const builtInShares = pricing?.defaults ?? [];
    const rows = useMemo(() => ruleRows(category, pricing?.defaults ?? []), [category, pricing]);
    const builtIn = (row: Row) => builtInShares.find(d => d.questionKey === row.questionKey && d.answerKey === row.answerKey)?.percent ?? 0;

    const saveRule = async (row: Row, percent: number, amount: number) => {
        const label = `${row.questionLabel}: ${row.answerLabel}`;
        try {
            const result = await upsertEvaluationRule({ category, questionKey: row.questionKey, answerKey: row.answerKey, label, deductionAmount: amount, deductionPercent: percent });
            if (result && typeof result === 'object' && 'error' in result && result.error) throw new Error(String(result.error));
        } catch (e) {
            setMessage({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' });
            return false;
        }
        setRules(prev => [...prev.filter(r => !(r.questionKey === row.questionKey && r.answerKey === row.answerKey)),
            { questionKey: row.questionKey, answerKey: row.answerKey, label, deductionAmount: amount, deductionPercent: percent }]);
        setMessage({ ok: true, text: `Saved: ${row.answerLabel}.` });
        return true;
    };

    const restoreBuiltIn = async (row: Row) => {
        const result = await deleteEvaluationRule(category, row.questionKey, row.answerKey);
        if ('error' in result && result.error) {
            setMessage({ ok: false, text: result.error });
            return;
        }
        setRules(prev => prev.filter(r => !(r.questionKey === row.questionKey && r.answerKey === row.answerKey)));
        setMessage({ ok: true, text: `${row.answerLabel}: back to the built-in ${pct(builtIn(row))}.` });
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border bg-card p-5">
                    <h3 className="mb-2 font-bold">How the offer is worked out</h3>
                    <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                        {HOW_IT_WORKS.map(line => <li key={line}>{line}</li>)}
                    </ol>
                </section>
                {pricing ? <MinOffer value={pricing.minOfferPercent} onMessage={setMessage} /> : (
                    <section className="rounded-2xl border border-amber-400 bg-amber-50 p-5 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                        The pricing server did not answer, so built-in shares and the lowest offer are not shown. Reload the page to try again.
                    </section>
                )}
                <MaxValueCalculator category={category} />
            </div>

            {message ? <p className={`rounded-xl border px-4 py-2 text-sm ${message.ok ? 'border-primary/30 bg-primary/10 text-primary' : 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>{message.text}</p> : null}

            <div className="overflow-x-auto rounded-2xl border bg-card">
                <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b bg-muted/50 text-muted-foreground">
                        <tr>
                            <th className="p-3 font-semibold">Question</th>
                            <th className="p-3 font-semibold">Answer</th>
                            <th className="p-3 font-semibold">Now takes</th>
                            <th className="w-28 p-3 font-semibold">% of max value</th>
                            <th className="w-32 p-3 font-semibold">+ ₹ amount</th>
                            <th className="w-40 p-3 text-right font-semibold">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {rows.map((row, i) => {
                            const cap = pricing?.caps[row.questionKey];
                            const firstOfQuestion = i === 0 || rows[i - 1].questionKey !== row.questionKey;
                            return (
                                <RuleRow key={`${row.questionKey}|${row.answerKey}`} row={row} builtIn={builtIn(row)}
                                    capNote={firstOfQuestion && cap !== undefined && cap < MAX_SHARE ? `Together these take at most ${pct(cap)}` : undefined}
                                    rule={rules.find(r => r.questionKey === row.questionKey && r.answerKey === row.answerKey)}
                                    onSave={saveRule} onUseBuiltIn={restoreBuiltIn} onMessage={setMessage} />
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {!rows.length ? <p className="text-sm text-muted-foreground">No questions for this category.</p> : null}
        </div>
    );
}

function MinOffer({ value, onMessage }: { value: number; onMessage: (m: Message) => void }) {
    const [text, setText] = useState(String(value));
    const [saved, setSaved] = useState(value);
    const [busy, setBusy] = useState(false);
    const n = Number(text);
    const valid = text !== '' && Number.isFinite(n) && n >= 0 && n <= MAX_SHARE;

    const save = async () => {
        setBusy(true);
        const result = await savePricingMinOffer(n);
        setBusy(false);
        if ('error' in result && result.error) onMessage({ ok: false, text: result.error });
        else {
            setSaved(n);
            onMessage({ ok: true, text: `Lowest offer saved: ${pct(n)} of the max value.` });
        }
    };

    return (
        <section className="space-y-3 rounded-2xl border bg-card p-5">
            <div>
                <h3 className="font-bold">Lowest offer</h3>
                <p className="text-sm text-muted-foreground">No offer goes below this share of the max value, whatever the answers. It applies to every category.</p>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center overflow-hidden rounded-md border bg-background">
                    <input type="number" min={0} max={MAX_SHARE} value={text} onChange={e => setText(e.target.value.replace(/[^\d.]/g, ''))}
                        aria-label="Lowest offer, percent of the max value" className="w-20 bg-transparent p-2 text-sm outline-none" />
                    <span className="border-l bg-muted/50 px-2 py-2 text-xs text-muted-foreground">%</span>
                </div>
                <button type="button" disabled={!valid || n === saved || busy} onClick={save}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                </button>
            </div>
            <p className="text-sm font-semibold text-primary">{valid ? `A ₹50,000 phone never gets less than ${inr(50_000 * n / 100)}.` : `Enter 0 to ${MAX_SHARE}.`}</p>
        </section>
    );
}

const BRANDS = [
    { id: 'apple', label: 'Apple' },
    { id: 'samsung', label: 'Samsung / Google / OnePlus' },
    { id: 'other', label: 'Other brands' },
];

/** What max value a variant should have: launch price × the share its kind of device keeps at its age (backend rule). */
function MaxValueCalculator({ category }: { category: string }) {
    const [price, setPrice] = useState('');
    const [launched, setLaunched] = useState('');
    const [brand, setBrand] = useState('apple');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<Message | null>(null);
    const valid = Number(price) > 0 && /^\d{4}-(0[1-9]|1[0-2])$/.test(launched);

    const workOut = async () => {
        setBusy(true);
        const r = await suggestMaxValue(Number(price), launched, category, brand);
        setBusy(false);
        if ('error' in r && r.error) setResult({ ok: false, text: r.error });
        else if ('maxValue' in r) {
            setResult({ ok: true, text: `Max value ${inr(r.maxValue)}: keeps ${pct(r.keptPercent)} of the launch price at ${r.ageMonths} month${r.ageMonths === 1 ? '' : 's'} old.` });
        }
    };

    return (
        <section className="space-y-3 rounded-2xl border bg-card p-5 lg:col-span-2">
            <div>
                <h3 className="font-bold">Max value from the launch price</h3>
                <p className="text-sm text-muted-foreground">For a new model or variant: its launch price in India and launch month give its max value, lower as it gets older. Apple keeps value best, then Samsung, Google and OnePlus.</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm">Brand
                    <select value={brand} onChange={e => { setBrand(e.target.value); setResult(null); }} className="mt-1 block rounded-md border bg-background p-2 text-sm">
                        {BRANDS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                    </select>
                </label>
                <label className="text-sm">Launch price (₹)
                    <input inputMode="numeric" value={price} onChange={e => { setPrice(e.target.value.replace(/\D/g, '')); setResult(null); }} placeholder="134900"
                        className="mt-1 block w-36 rounded-md border bg-background p-2 text-sm" />
                </label>
                <label className="text-sm">Launched (YYYY-MM)
                    <input value={launched} onChange={e => { setLaunched(e.target.value.replace(/[^\d-]/g, '').slice(0, 7)); setResult(null); }} placeholder="2025-09"
                        className="mt-1 block w-32 rounded-md border bg-background p-2 text-sm" />
                </label>
                <button type="button" onClick={workOut} disabled={!valid || busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Work out
                </button>
            </div>
            {result ? <p className={`text-sm font-semibold ${result.ok ? 'text-primary' : 'text-red-500'}`}>{result.text}</p> : null}
        </section>
    );
}

function RuleRow({ row, rule, builtIn, capNote, onSave, onUseBuiltIn, onMessage }: {
    row: Row;
    rule: Rule | undefined;
    builtIn: number;
    capNote: string | undefined;
    onSave: (row: Row, percent: number, amount: number) => Promise<boolean>;
    onUseBuiltIn: (row: Row) => Promise<void>;
    onMessage: (m: Message) => void;
}) {
    const percentNow = rule ? rule.deductionPercent : builtIn;
    const amountNow = rule ? rule.deductionAmount : 0;
    const [percent, setPercent] = useState(String(percentNow));
    const [amount, setAmount] = useState(String(amountNow));
    const [busy, setBusy] = useState<'save' | 'reset' | null>(null);
    useEffect(() => {
        setPercent(String(percentNow));
        setAmount(String(amountNow));
    }, [percentNow, amountNow]);
    const changed = percent !== String(percentNow) || amount !== String(amountNow);

    const save = async () => {
        const p = Number(percent) || 0;
        if (p > MAX_SHARE) return onMessage({ ok: false, text: `One answer can take at most ${MAX_SHARE}% of the max value.` });
        setBusy('save');
        await onSave(row, p, Math.round(Number(amount) || 0));
        setBusy(null);
    };

    const reset = async () => {
        setBusy('reset');
        await onUseBuiltIn(row);
        setBusy(null);
    };

    return (
        <tr className="transition-colors hover:bg-muted/30">
            <td className="p-3 align-top text-foreground/80">
                <span className="line-clamp-2" title={row.questionLabel}>{row.questionLabel}</span>
                {capNote ? <span className="mt-1 block text-xs text-muted-foreground">{capNote}</span> : null}
            </td>
            <td className="p-3 align-top font-semibold">{row.answerLabel}</td>
            <td className="p-3 align-top">
                {rule ? (
                    <span className="rounded-full border border-primary px-2 py-0.5 text-xs font-bold text-primary">
                        Your rule: {pct(rule.deductionPercent)}{rule.deductionAmount ? ` + ₹${rule.deductionAmount.toLocaleString('en-IN')}` : ''}
                    </span>
                ) : <span className="rounded-full border px-2 py-0.5 text-xs font-bold text-muted-foreground">Built-in {pct(builtIn)}</span>}
            </td>
            <td className="p-3 align-top">
                <input type="number" min={0} max={MAX_SHARE} step="0.5" value={percent} onChange={e => setPercent(e.target.value.replace(/[^\d.]/g, ''))}
                    aria-label={`${row.answerLabel}: percent of the max value`} className="w-20 rounded-md border bg-background p-2 text-sm" />
            </td>
            <td className="p-3 align-top">
                <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                    aria-label={`${row.answerLabel}: rupee amount`} className="w-24 rounded-md border bg-background p-2 text-sm" />
            </td>
            <td className="p-3 text-right align-top">
                <div className="flex items-center justify-end gap-2">
                    {rule ? (
                        <button type="button" onClick={reset} disabled={busy !== null} title={`Use the built-in ${pct(builtIn)}`}
                            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-50">
                            {busy === 'reset' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Built-in
                        </button>
                    ) : null}
                    <button type="button" onClick={save} disabled={!changed || busy !== null} title="Save as your rule"
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40">
                        {busy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                    </button>
                </div>
            </td>
        </tr>
    );
}
