'use client';

// One picture for an admin form: a preview, an upload button, the path (editable), and the photo format this place
// needs, as in the Admin app's ImageField.
import { useState } from 'react';
import { ImageIcon, Upload } from 'lucide-react';
import { uploadImage } from '@/actions/upload';

export function PictureField({ label, value, onChange, hint, wide }: {
    label: string;
    value: string;
    onChange: (path: string) => void;
    /** The picture format this place needs, shown next to the upload button. */
    hint?: string;
    /** Landscape preview (carousel cards) instead of a portrait one (devices). */
    wide?: boolean;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const upload = async (file: File | undefined) => {
        if (!file) return;
        setBusy(true);
        setError('');
        try {
            const form = new FormData();
            form.append('file', file);
            onChange(await uploadImage(form));
        } catch (e) {
            setError(e instanceof Error && e.message !== 'Internal error' ? e.message : 'Upload failed. Use a JPG, PNG or WebP up to 10 MB.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-2">
            <span className="text-sm font-semibold">{label}</span>
            <div className="flex flex-wrap items-start gap-3">
                <div className={`${wide ? 'aspect-[2/1] w-48' : 'h-28 w-24'} shrink-0 overflow-hidden rounded-xl border bg-muted/40`}>
                    {value ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={value} alt="" className={`h-full w-full ${wide ? 'object-cover' : 'object-contain'}`} />
                    ) : <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon className="h-6 w-6 opacity-50" /></div>}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-bold hover:border-primary">
                        <Upload className="h-4 w-4" /> {busy ? 'Uploading…' : value ? 'Upload a different picture' : 'Upload a picture'}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy} onChange={e => upload(e.target.files?.[0])} />
                    </label>
                    <input value={value} onChange={e => onChange(e.target.value)} placeholder="/uploads/… or https://…" aria-label={`${label} path`}
                        className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs text-muted-foreground" />
                    {hint ? (
                        <p className="whitespace-pre-line rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                            <span className="font-bold">Photo format: </span>{hint}
                        </p>
                    ) : null}
                    {error ? <p className="text-xs text-red-500">{error}</p> : null}
                </div>
            </div>
        </div>
    );
}
