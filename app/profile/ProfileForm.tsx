'use client';

import { useActionState, useEffect, useState } from 'react';
import { updateProfile } from '@/actions/profile';
import { CheckCircle2, User as UserIcon, Phone, Mail, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cleanPhone, nameProblem, phoneProblem } from '@/lib/validate';
import { invalidBox, useFormChecks } from '@/lib/useFormChecks';
import { FieldError } from '@/components/ui/FieldError';

export default function ProfileForm({ user }: { user: any }) {
    const [state, formAction, pending] = useActionState(updateProfile, null);
    const [successMessage, setSuccessMessage] = useState(false);
    const [name, setName] = useState<string>(user.name ?? '');
    const [phone, setPhone] = useState<string>(cleanPhone(user.phone ?? ''));
    const checks = useFormChecks({ name: nameProblem(name), phone: phoneProblem(phone) });

    useEffect(() => {
        if (state?.success) {
            setSuccessMessage(true);
            const timer = setTimeout(() => setSuccessMessage(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [state]);

    return (
        <form action={formAction} noValidate className="space-y-6" onSubmit={e => { if (!checks.ok()) e.preventDefault(); }}>
            <AnimatePresence>
                {state?.error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2"
                    >
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p>{state.error}</p>
                    </motion.div>
                )}
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 rounded-xl bg-green-500/10 text-green-600 dark:text-green-500 text-sm font-medium flex items-center gap-2"
                    >
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                        <p>Profile updated successfully!</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <div className="relative flex items-center">
                        <UserIcon className="absolute left-4 w-5 h-5 text-muted-foreground" />
                        <input
                            type="text"
                            name="name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onBlur={checks.leave('name')}
                            aria-invalid={!!checks.show('name')}
                            className={`w-full pl-11 pr-4 py-3 bg-background border rounded-xl focus:ring-2 focus:ring-primary/50 outline-none ${checks.show('name') ? invalidBox : ''}`}
                            placeholder="Your Name"
                        />
                    </div>
                    <FieldError message={checks.show('name')} />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address (Read-only)</label>
                    <div className="relative flex items-center">
                        <Mail className="absolute left-4 w-5 h-5 text-muted-foreground" />
                        <input
                            type="email"
                            value={user.email}
                            disabled
                            className="w-full pl-11 pr-4 py-3 bg-muted/50 text-muted-foreground cursor-not-allowed border rounded-xl outline-none"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Phone Number</label>
                    <div className="flex gap-2 relative">
                        <div className="flex items-center justify-center px-4 bg-muted rounded-xl border font-medium text-muted-foreground h-12">
                            +91
                        </div>
                        <div className="relative flex-1">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="tel"
                                name="phone"
                                inputMode="numeric"
                                value={phone}
                                onChange={e => setPhone(cleanPhone(e.target.value))}
                                onBlur={checks.leave('phone')}
                                aria-invalid={!!checks.show('phone')}
                                className={`w-full pl-11 pr-4 py-3 bg-background border rounded-xl focus:ring-2 focus:ring-primary/50 outline-none tracking-wide ${checks.show('phone') ? invalidBox : ''}`}
                                placeholder="9876543210"
                            />
                        </div>
                    </div>
                    <FieldError message={checks.show('phone')} />
                </div>
            </div>

            <button
                type="submit"
                disabled={pending}
                className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 mt-8"
            >
                {pending ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Saving Changes...
                    </>
                ) : (
                    'Save Changes'
                )}
            </button>
        </form>
    );
}
