import { Check, X } from 'lucide-react';
import { TrackableOrder, failureReasonOf, isFailed, trackerSteps } from '@/lib/order-status';

// The order tracker shown to customers (My Orders) and in the admin panel's order details. Steps and their states
// come from lib/order-status.ts → trackerSteps, the same rules the admin panel and the executive's list use.
export default function OrderStepper({ order }: { order: TrackableOrder }) {
    const steps = trackerSteps(order);
    const failed = isFailed(order.status);
    const reason = failed ? failureReasonOf(order) : null;

    return (
        <div className="w-full py-2 mb-4 mt-2">
            {failed && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-3 text-sm text-red-800 dark:text-red-300">
                    <span className="font-bold">This pickup was cancelled.</span>{reason ? ` Reason: ${reason}` : ''}
                </div>
            )}
            <ol className="flex flex-col sm:flex-row sm:items-start gap-0 sm:gap-1">
                {steps.map((step, idx) => {
                    const done = step.state === 'done';
                    const current = step.state === 'current';
                    const stepFailed = step.state === 'failed';
                    const last = idx === steps.length - 1;
                    return (
                        <li key={step.key} className="relative flex sm:flex-1 sm:flex-col sm:items-center gap-3 sm:gap-2 pb-5 sm:pb-0 min-w-0">
                            {/* connector to the next step: vertical on phones, horizontal from sm up */}
                            {!last && (
                                <span aria-hidden className={`absolute left-[17px] top-9 bottom-0 w-[3px] sm:left-[calc(50%+20px)] sm:right-[calc(-50%+20px)] sm:top-[17px] sm:bottom-auto sm:w-auto sm:h-[3px] rounded-full ${done ? 'bg-green-500' : 'bg-muted'}`} />
                            )}
                            <span className={`relative z-10 shrink-0 w-9 h-9 rounded-full flex items-center justify-center border-[3px] bg-card transition-all ${
                                done ? 'border-green-500 text-green-500' :
                                current ? 'border-amber-500 text-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.35)]' :
                                stepFailed ? 'border-red-500 text-red-500' :
                                'border-muted text-muted-foreground'
                            }`}>
                                {done ? <Check className="w-4 h-4 stroke-[3]" /> : stepFailed ? <X className="w-4 h-4 stroke-[3]" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                            </span>
                            <div className="min-w-0 sm:text-center sm:px-1">
                                <p className={`text-xs sm:text-[11px] font-bold leading-tight ${
                                    done ? 'text-green-600 dark:text-green-500' :
                                    current ? 'text-amber-600 dark:text-amber-500' :
                                    stepFailed ? 'text-red-600 dark:text-red-400' :
                                    'text-muted-foreground'
                                }`}>
                                    {step.label}
                                </p>
                                {step.detail && (
                                    <p className="text-[11px] sm:text-[10px] text-muted-foreground leading-snug mt-0.5 break-words">{step.detail}</p>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
