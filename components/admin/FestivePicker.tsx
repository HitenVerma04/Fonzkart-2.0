'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { saveFestiveTheme } from '@/actions/shop';
import { FESTIVE_THEMES } from '@/lib/festive';

const NORMAL = { id: 'none', label: 'Normal green', when: 'No festive theme', colors: ['#15803d', '#22c55e', '#bbf7d0'] };

export function FestivePicker({ current }: { current: string }) {
    const [theme, setTheme] = useState(current);
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState('');

    const choose = async (id: string) => {
        setSaving(id);
        setError('');
        const result = await saveFestiveTheme(id);
        setSaving(null);
        if (result.ok) setTheme(id);
        else setError(result.error);
    };

    return (
        <div className="space-y-3">
            {[NORMAL, ...FESTIVE_THEMES].map(option => (
                <button key={option.id} disabled={!!saving} onClick={() => choose(option.id)} className={`flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-colors ${theme === option.id ? 'border-primary' : 'hover:border-primary/40'}`}>
                    <span className="flex overflow-hidden rounded-full">
                        {option.colors.map(color => <span key={color} className="h-8 w-5" style={{ background: color }} />)}
                    </span>
                    <span className="flex-1">
                        <span className="block font-bold">{option.label}</span>
                        <span className="block text-sm text-muted-foreground">{option.when}</span>
                    </span>
                    {saving === option.id ? <span className="text-sm text-muted-foreground">Saving…</span> : null}
                    {theme === option.id && !saving ? <Check className="h-5 w-5 text-primary" /> : null}
                </button>
            ))}
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
        </div>
    );
}
