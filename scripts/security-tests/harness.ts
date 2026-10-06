// Shared helpers for running the website's server code directly: one cookie jar per actor (read by the next/headers
// stub), sign-in through the real signin action, and access to the JSX that pages return (captured as data).
import { PrismaClient } from '@prisma/client';
import * as auth from '@/actions/auth';
import AdminLayout from '@/app/admin/layout';

export const prisma = new PrismaClient();

const jars = new Map<string, Map<string, any>>();

/** Makes `actor` the caller of everything that runs next and returns their cookie jar. */
export function as(actor: string): Map<string, any> {
    if (!jars.has(actor)) jars.set(actor, new Map());
    const jar = jars.get(actor)!;
    (globalThis as any).__jar = jar;
    return jar;
}

export function cookie(actor: string, name: string): string | undefined {
    return jars.get(actor)?.get(name)?.value;
}

export function setCookie(actor: string, name: string, value: string | undefined) {
    if (value === undefined) jars.get(actor)?.delete(name);
    else as(actor).set(name, { value, opts: {} });
}

export const form = (o: Record<string, unknown>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(o)) if (v != null) fd.append(k, String(v));
    return fd;
};

export type Outcome = { returned?: any; redirect?: string; thrown?: string };

/** Runs a server action and records what the browser would see: a value, a redirect or a thrown error. */
export async function attempt(fn: () => Promise<any>): Promise<Outcome> {
    try {
        return { returned: (await fn()) ?? null };
    } catch (e: any) {
        if (e?.digest === 'NEXT_REDIRECT') return { redirect: e.url };
        return { thrown: e?.message ?? String(e) };
    }
}

export async function signIn(actor: string, email: string, password = 'pw') {
    as(actor);
    const outcome = await attempt(() => auth.signin(null as any, form({ email, password })));
    if (!cookie(actor, 'session')) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(outcome)}`);
}

/** Renders a page behind the real admin layout gate (which redirects non-staff). */
export async function adminPage(page: () => Promise<any>) {
    await AdminLayout({ children: null } as any);
    return page();
}

export function* walk(node: any): Generator<any> {
    if (Array.isArray(node)) {
        for (const n of node) yield* walk(n);
        return;
    }
    if (node && typeof node === 'object' && node.$$el) {
        yield node;
        yield* walk(node.props?.children);
    }
}

export const find = (tree: any, pred: (e: any) => boolean) => [...walk(tree)].filter(pred);
export const propsOf = (tree: any, component: any) => find(tree, e => e.type === component).map(e => e.props);
