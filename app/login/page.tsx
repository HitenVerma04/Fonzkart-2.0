
'use client';

import { useActionState, useState } from 'react';
import { signin } from '@/actions/auth';
import Link from 'next/link';
import { Smartphone, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { emailOrPhoneProblem } from '@/lib/validate';
import { invalidBox, useFormChecks } from '@/lib/useFormChecks';
import { FieldError } from '@/components/ui/FieldError';

export default function LoginPage() {
    const [state, action, isPending] = useActionState(signin, null);
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const checks = useFormChecks({ id: emailOrPhoneProblem(id), password: password ? null : 'Enter your password.' });

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
                    <h1 className="text-2xl font-bold">Welcome Back</h1>
                    <p className="text-muted-foreground">Sign in to manage your orders</p>
                </div>

                <form action={action} noValidate className="space-y-4" onSubmit={e => { if (!checks.ok()) e.preventDefault(); }}>
                    <div>
                        <label className="block text-sm font-medium mb-1">Email or Phone Number</label>
                        <input
                            name="email"
                            type="text"
                            autoComplete="username"
                            value={id}
                            onChange={e => setId(e.target.value)}
                            onBlur={checks.leave('id')}
                            aria-invalid={!!checks.show('id')}
                            className={`w-full h-12 px-4 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all ${checks.show('id') ? invalidBox : ''}`}
                            placeholder="Email or 10-digit number"
                        />
                        <FieldError message={checks.show('id')} />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium">Password</label>
                            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                                Forgot your password?
                            </Link>
                        </div>
                        <input
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onBlur={checks.leave('password')}
                            aria-invalid={!!checks.show('password')}
                            className={`w-full h-12 px-4 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all ${checks.show('password') ? invalidBox : ''}`}
                            placeholder="••••••••"
                        />
                        <FieldError message={checks.show('password')} />
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
                        {isPending ? <Loader2 className="animate-spin" /> : 'Log In'}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm">
                    Don&apos;t have an account? {' '}
                    <Link href="/signup" className="text-primary font-bold hover:underline">
                        Sign Up
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}
