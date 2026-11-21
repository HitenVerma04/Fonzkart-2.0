'use client';

// The cities a partner is responsible for (several; one is the main city, ★): chosen cities as chips on top, a search
// box and a checklist below. Posts `cityIds` (one input per city, main city first) and `mainCityId` with its form.
// Cities this person may not change (another zonal head's) show as locked chips and are kept by the server. The Admin
// app's CityChecklist (mobile/apps/admin/src/CityChecklist.tsx) works the same way.
import { useMemo, useState } from 'react';
import { Check, Lock, Search, Star, X } from 'lucide-react';

type CityOption = { id: string; name: string; pincodes?: string[] };

export default function PartnerCitiesPicker({ cities, initial = [], initialMain, locked = [], compact }: {
    cities: CityOption[];
    initial?: string[];
    initialMain?: string | null;
    locked?: CityOption[];
    compact?: boolean;
}) {
    const [chosen, setChosen] = useState<string[]>(initial.filter(id => cities.some(c => c.id === id)));
    const [main, setMain] = useState<string | undefined>(initialMain ?? initial[0] ?? undefined);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(!compact);
    const nameOf = (id: string) => cities.find(c => c.id === id)?.name ?? locked.find(c => c.id === id)?.name ?? id;
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return cities.filter(c => !q || c.name.toLowerCase().includes(q))
            .sort((a, b) => Number(chosen.includes(b.id)) - Number(chosen.includes(a.id)) || a.name.localeCompare(b.name));
    }, [cities, query, chosen]);

    const toggle = (id: string) => setChosen(now => {
        const next = now.includes(id) ? now.filter(x => x !== id) : [...now, id];
        setMain(m => (m && (next.includes(m) || locked.some(l => l.id === m)) ? m : next[0]));
        return next;
    });
    const all = [...locked.map(l => l.id), ...chosen];
    const ordered = main && all.includes(main) ? [main, ...all.filter(id => id !== main)] : all;

    return (
        <div className="space-y-2">
            {ordered.map(id => <input key={id} type="hidden" name="cityIds" value={id} />)}
            {main ? <input type="hidden" name="mainCityId" value={main} /> : null}

            <div className="flex flex-wrap gap-1.5">
                {ordered.length ? ordered.map(id => {
                    const isLocked = locked.some(l => l.id === id);
                    return (
                        <span key={id} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${id === main ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-100 dark:border-emerald-500/20'}`}>
                            {id === main ? <Star className="h-3 w-3 fill-current" /> : null}
                            {nameOf(id)}
                            {isLocked ? <Lock className="h-3 w-3 opacity-70" /> : (
                                <button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => toggle(id)} className="opacity-70 hover:opacity-100"><X className="h-3 w-3" /></button>
                            )}
                        </span>
                    );
                }) : <span className="text-xs text-muted-foreground">No city chosen yet</span>}
                {compact && (
                    <button type="button" onClick={() => setOpen(o => !o)} className="rounded-full border border-emerald-600 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {open ? 'Done' : ordered.length ? 'Edit cities' : 'Add cities'}
                    </button>
                )}
            </div>

            {open && (
                <div className="rounded-lg border bg-background">
                    <div className="relative border-b">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${cities.length} cities`}
                            onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                            className="h-9 w-full bg-transparent pl-9 pr-3 text-sm outline-none" />
                    </div>
                    <ul className="max-h-56 overflow-y-auto p-1">
                        {shown.map(c => {
                            const on = chosen.includes(c.id);
                            return (
                                <li key={c.id} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${on ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'hover:bg-muted'}`}>
                                    <button type="button" onClick={() => toggle(c.id)} className="flex flex-1 items-center gap-2 text-left" aria-pressed={on}>
                                        <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-muted-foreground/40'}`}>
                                            {on ? <Check className="h-3 w-3" /> : null}
                                        </span>
                                        <span className="font-medium">{c.name}</span>
                                        {c.pincodes ? <span className="text-[11px] text-muted-foreground">{c.pincodes.length} pincodes</span> : null}
                                    </button>
                                    {on && (c.id === main
                                        ? <span className="text-[10px] font-black uppercase text-emerald-600">Main</span>
                                        : <button type="button" onClick={() => setMain(c.id)} className="text-[11px] font-bold text-emerald-700 hover:underline dark:text-emerald-400">Make main</button>)}
                                </li>
                            );
                        })}
                        {!shown.length && <li className="px-2 py-3 text-center text-xs text-muted-foreground">No city matches “{query.trim()}”.</li>}
                    </ul>
                </div>
            )}
        </div>
    );
}
