// The message under a form field that is wrong (see lib/useFormChecks.ts).
import { AlertCircle } from 'lucide-react';

export function FieldError({ message, id }: { message: string | null | undefined; id?: string }) {
    if (!message) return null;
    return (
        <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-red-600 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {message}
        </p>
    );
}
