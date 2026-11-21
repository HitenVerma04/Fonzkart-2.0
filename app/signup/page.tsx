'use client';

import { useActionState, useState } from 'react';
import { signup } from '@/actions/auth';
import Link from 'next/link';
import { Smartphone, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cleanPhone, emailProblem, nameProblem, passwordProblem, phoneProblem } from '@/lib/validate';
import { invalidBox, useFormChecks } from '@/lib/useFormChecks';
import { FieldError } from '@/components/ui/FieldError';

const box = 'w-full h-12 px-4 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all';

export default function SignupPage() {
    const [state, action, isPending] = useActionState(signup, null);
    const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
    const checks = useFormChecks({
        name: nameProblem(form.name),
        email: emailProblem(form.email),
        phone: phoneProblem(form.phone),
        password: passwordProblem(form.password),
    });

    return (
        <div className="flex min-h-screen items-center justify-center bg-accent/20 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-card border rounded-2xl shadow-xl p-8"
            >
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-primary/10 p-3 rounded-xl mb-4">
                        <Smartphone className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold">Create Account</h1>
                    <p className="text-muted-foreground">Start selling your gadgets today</p>
                </div>

                {/* Checked here first (lib/validate.ts); the server checks again. */}
                <form action={action} noValidate className="space-y-4" onSubmit={e => { if (!checks.ok()) e.preventDefault(); }}>
                    <div>
                        <label className="block text-sm font-medium mb-1">Full Name</label>
                        <input
                            name="name"
                            type="text"
                            autoComplete="name"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            onBlur={checks.leave('name')}
                            aria-invalid={!!checks.show('name')}
                            className={`${box} ${checks.show('name') ? invalidBox : ''}`}
                            placeholder="John Doe"
                        />
                        <FieldError message={checks.show('name')} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                            name="email"
                            type="email"
                            autoComplete="email"
                            value={form.email}
                            onChange={e => setForm(f => ({ ...f, email: e.target.value.trim() }))}
                            onBlur={checks.leave('email')}
                            aria-invalid={!!checks.show('email')}
                            className={`${box} ${checks.show('email') ? invalidBox : ''}`}
                            placeholder="john@example.com"
                        />
                        <FieldError message={checks.show('email')} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Phone Number</label>
                        <div className={`flex w-full border rounded-lg bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all ${checks.show('phone') ? invalidBox : ''}`}>
                            <span className="flex items-center pl-4 pr-3 border-r border-border bg-muted/20 text-muted-foreground font-medium text-sm">+91</span>
                            <input
                                name="phone"
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel-national"
                                value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: cleanPhone(e.target.value) }))}
                                onBlur={checks.leave('phone')}
                                aria-invalid={!!checks.show('phone')}
                                className="w-full h-12 px-4 outline-none bg-transparent"
                                placeholder="9876543210"
                            />
                        </div>
                        <FieldError message={checks.show('phone')} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Password</label>
                        <input
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            onBlur={checks.leave('password')}
                            aria-invalid={!!checks.show('password')}
                            className={`${box} ${checks.show('password') ? invalidBox : ''}`}
                            placeholder="••••••••"
                        />
                        <FieldError message={checks.show('password')} />
                        {!checks.show('password') && <p className="mt-1.5 text-xs text-muted-foreground">At least 6 characters.</p>}
                    </div>

                    {state?.error && (
                        <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-lg text-center">
                            {state.error}
                        </div>
                    )}

                    <button
                        disabled={isPending}
                        className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                    >
                        {isPending ? <Loader2 className="animate-spin" /> : 'Sign Up'}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm">
                    Already have an account? {' '}
                    <Link href="/login" className="text-primary font-bold hover:underline">
                        Log In
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}
