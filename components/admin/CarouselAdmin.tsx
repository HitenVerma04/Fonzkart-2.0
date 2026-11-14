'use client';

// Edit carousel view (as in the Admin app): the cards customers swipe through under "Choose a category" on the
// Customer app's home screen. Add, edit (picture, title, text, the category a card opens), show or hide, reorder,
// delete. Cards are 2:1 in the app.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { deleteCarouselSlide, reorderCarousel, saveCarouselSlide } from '@/actions/buyRepair';
import { PictureField } from '@/components/admin/PictureField';
import type { CarouselSlide, CarouselSlideInput } from '@/lib/buyRepair';

const field = 'w-full rounded-lg border bg-background px-3 py-2 text-sm';
const MAX_TITLE = 60;
const MAX_TEXT = 120;
const EMPTY: CarouselSlideInput = { imageUrl: '', title: '', subtitle: '', category: null, isActive: true };
const CATEGORIES = [
    { id: 'smartphone', name: 'Smartphones' }, { id: 'tablet', name: 'Tablets' }, { id: 'camera', name: 'Cameras' },
    { id: 'laptop', name: 'Laptops' }, { id: 'watch', name: 'Smartwatches' }, { id: 'smarttv', name: 'Smart TVs' },
    { id: 'console', name: 'Consoles' }, { id: 'desktop', name: 'Desktops' }, { id: 'earbuds', name: 'Earbuds' },
];
const categoryName = (id: string | null) => CATEGORIES.find(c => c.id === id)?.name ?? id;

export function CarouselAdmin({ slides }: { slides: CarouselSlide[] }) {
    const router = useRouter();
    const [editing, setEditing] = useState<CarouselSlide | 'new' | null>(null);
    const [form, setForm] = useState<CarouselSlideInput>(EMPTY);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const open = (s: CarouselSlide | 'new') => {
        setEditing(s);
        setMessage(null);
        setDeleting(null);
        setForm(s === 'new' ? EMPTY : { imageUrl: s.imageUrl, title: s.title, subtitle: s.subtitle, category: s.category, isActive: s.isActive, displayOrder: s.displayOrder });
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

    const move = (index: number, by: -1 | 1) => {
        const other = index + by;
        if (other < 0 || other >= slides.length) return;
        const order = [...slides];
        [order[index], order[other]] = [order[other], order[index]];
        void run(() => reorderCarousel(order.map((s, i) => ({ id: s.id, displayOrder: i }))), `"${slides[index].title}" moved.`);
    };

    const toggle = (s: CarouselSlide) => void run(() => saveCarouselSlide(s.id, { imageUrl: s.imageUrl, title: s.title, subtitle: s.subtitle, category: s.category, isActive: !s.isActive, displayOrder: s.displayOrder }),
        `"${s.title}" ${s.isActive ? 'hidden' : 'shown in the app'}.`);

    const canSave = !!form.imageUrl.trim() && !!form.title.trim() && form.title.trim().length <= MAX_TITLE && form.subtitle.trim().length <= MAX_TEXT;
    const save = () => {
        const input = { ...form, imageUrl: form.imageUrl.trim(), title: form.title.trim(), subtitle: form.subtitle.trim() };
        void run(() => saveCarouselSlide(editing === 'new' || !editing ? null : editing.id, input), `"${input.title}" ${editing === 'new' ? 'added' : 'saved'}.`, () => setEditing(null));
    };

    return (
        <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
                The cards customers swipe through under &quot;Choose a category&quot; on the Customer app&apos;s home screen, in this order. Hidden cards stay here but are not shown.
            </p>
            {message ? <p className={`rounded-xl border px-4 py-2 text-sm ${message.ok ? 'border-primary/30 bg-primary/10 text-primary' : 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>{message.text}</p> : null}

            {editing ? (
                <section className="space-y-4 rounded-2xl border bg-card p-5">
                    <h2 className="text-lg font-bold">{editing === 'new' ? 'New card' : 'Edit card'}</h2>
                    <PictureField label="Picture" wide value={form.imageUrl} onChange={imageUrl => setForm({ ...form, imageUrl })}
                        hint={'Landscape, 2:1 (twice as wide as tall), e.g. 1600 × 800 px or at least 1200 × 600 px.\nJPG, PNG or WebP, up to 10 MB.\nKeep words and faces away from the edges: they can be cropped, and the bottom-left holds the title.'} />
                    {form.imageUrl.trim() ? (
                        <div className="relative aspect-[2/1] max-w-md overflow-hidden rounded-2xl bg-zinc-900">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={form.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-black/25" />
                            <div className="absolute bottom-0 p-4 text-white">
                                <p className="text-lg font-black">{form.title || 'Title'}</p>
                                {form.subtitle ? <p className="text-sm opacity-90">{form.subtitle}</p> : null}
                            </div>
                        </div>
                    ) : null}
                    <label className="block text-sm">Title <span className="text-xs text-muted-foreground">{form.title.length}/{MAX_TITLE}</span>
                        <input className={field} maxLength={MAX_TITLE} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
                    <label className="block text-sm">Text (optional) <span className="text-xs text-muted-foreground">{form.subtitle.length}/{MAX_TEXT}</span>
                        <textarea className={field} rows={2} maxLength={MAX_TEXT} value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} /></label>
                    <label className="block text-sm">The card opens
                        <select className={field} value={form.category ?? ''} onChange={e => setForm({ ...form, category: e.target.value || null })}>
                            <option value="">Nothing (no tap)</option>
                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Show in the app</label>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setEditing(null)} className="rounded-full border px-5 py-2 text-sm font-bold">Cancel</button>
                        <button type="button" disabled={!canSave || busy} onClick={save} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
                    </div>
                </section>
            ) : (
                <button type="button" onClick={() => open('new')} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">Add a card</button>
            )}

            {slides.length ? (
                <div className="grid gap-3">
                    {slides.map((s, index) => (
                        <article key={s.id} className={`flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-3 ${s.isActive ? '' : 'opacity-60'}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={s.imageUrl} alt="" className="aspect-[2/1] w-32 shrink-0 rounded-lg bg-muted object-cover" />
                            <div className="min-w-0 flex-1">
                                <p className="font-bold">{s.title}</p>
                                {s.subtitle ? <p className="text-sm text-muted-foreground">{s.subtitle}</p> : null}
                                <p className="text-xs text-muted-foreground">{s.category ? `Opens ${categoryName(s.category)}` : 'No tap'}{s.isActive ? '' : ' · Hidden'}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
                                <button type="button" aria-label="Move up" disabled={index === 0 || busy} onClick={() => move(index, -1)} className="rounded-full border p-1.5 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                                <button type="button" aria-label="Move down" disabled={index === slides.length - 1 || busy} onClick={() => move(index, 1)} className="rounded-full border p-1.5 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                                <button type="button" onClick={() => open(s)} className="text-primary hover:underline">Edit</button>
                                <button type="button" disabled={busy} onClick={() => toggle(s)} className="hover:underline">{s.isActive ? 'Hide' : 'Show'}</button>
                                <button type="button" disabled={busy} className="text-red-500 hover:underline"
                                    onClick={() => deleting === s.id ? void run(() => deleteCarouselSlide(s.id), `"${s.title}" deleted.`, () => setDeleting(null)) : setDeleting(s.id)}>
                                    {deleting === s.id ? 'Click again to delete' : 'Delete'}
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            ) : <p className="text-sm text-muted-foreground">No cards yet. The carousel is hidden in the app until you add one.</p>}
        </div>
    );
}
