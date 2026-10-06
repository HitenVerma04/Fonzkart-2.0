// Executes backend/src/test/resources/golden/auth-scenario.json against the website's server actions (Prisma, jose,
// bcryptjs, nodemailer → Mailpit) on an empty database and writes the expected outcome that AuthScenarioParityTest
// replays against Spring Boot.   tsx scripts/security-tests/auth-ref.ts <scenario.json> <expected.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { jwtVerify } from 'jose';
import * as auth from '@/actions/auth';
import * as inline from '@/actions/inlineAuth';
import { updateProfile } from '@/actions/profile';
import * as admin from '@/actions/admin';
import { getSession, logout } from '@/lib/session';
import { as, form, prisma } from './harness';

const KEY = new TextEncoder().encode(process.env.AUTH_SECRET!);
const KNOWN_THROWN = ['Unauthorized', 'Forbidden: Admin access required', 'Forbidden: Outside your assigned cities',
  'Forbidden: Outside your team', "Forbidden: Cannot change this user's role"];
const DROP = new Set(['createdAt', 'updatedAt', 'passwordHash', 'resetToken', 'resetTokenExpiry']);

async function idMap() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  return new Map(users.map(u => [u.id, u.email]));
}

function normalize(v: any, ids: Map<string, string>): any {
  if (Array.isArray(v)) return v.map(x => normalize(x, ids));
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const out: any = {};
    for (const [k, x] of Object.entries(v)) if (!DROP.has(k) && x !== undefined) out[k] = normalize(x, ids);
    return out;
  }
  if (typeof v === 'string' && ids.has(v)) return `<id:${ids.get(v)}>`;
  return v;
}

async function resolve(input: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (typeof v === 'string' && v.startsWith('$otp:')) {
      out[k] = (await prisma.user.findFirst({ where: { email: v.slice(5) } }))?.resetToken ?? 'NO-OTP';
    } else if (typeof v === 'string' && v.startsWith('$id:')) {
      out[k] = (await prisma.user.findFirst({ where: { email: v.slice(4) } }))?.id ?? 'NO-ID';
    } else out[k] = v;
  }
  return out;
}

async function invoke(action: string, i: any) {
  switch (action) {
    case 'signin': return auth.signin(null, form(i));
    case 'signup': return auth.signup(null, form(i));
    case 'verifyEmail': return auth.verifyEmailSignup(null, form(i));
    case 'requestPasswordReset': return auth.requestPasswordReset(null, form(i));
    case 'verifyAndResetPassword': return auth.verifyAndResetPassword(null, form(i));
    case 'quickRegister': return inline.quickRegister(form(i));
    case 'quickLogin': return inline.quickLogin(form(i));
    case 'updateProfile': return updateProfile(null, form(i));
    case 'logout': return logout();
    case 'session': return getSession();
    case 'getAdmins': return admin.getAdmins();
    case 'addAdmin': return admin.addAdmin(i.email);
    case 'addZonalHead': return admin.addZonalHead(i.email);
    case 'addRelationshipManager': return admin.addRelationshipManager(i.email);
    case 'addPartner': return admin.addPartner(i.email, i.cityId, i.managerId);
    case 'removeAdmin': return admin.removeAdmin(i.email);
    case 'removeUserRole': return admin.removeUserRole(i.email);
    case 'updatePartnerManager': return admin.updatePartnerManager(i.partnerId, i.managerId);
    case 'getPartnersManagedBy': return admin.getPartnersManagedBy(i.managerId);
    default: throw new Error('unknown action ' + action);
  }
}

async function cookieSession(jar: Map<string, any>) {
  const c = jar.get('session');
  if (!c || !c.value) return null;
  try { return (await jwtVerify(c.value, KEY, { algorithms: ['HS256'] })).payload.user ?? null; } catch { return 'INVALID'; }
}

async function main() {
  const scenario = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const results: any[] = [];
  for (const step of scenario.steps) {
    const jar = as(step.actor);
    const input = await resolve(step.input);
    let outcome: any;
    try {
      const value = await invoke(step.action, input);
      outcome = step.action === 'session' ? { returned: value ? { user: value.user } : null } : { returned: value ?? null };
    } catch (e: any) {
      outcome = e?.digest === 'NEXT_REDIRECT' ? { redirect: e.url }
        : { thrown: KNOWN_THROWN.includes(e?.message) ? e.message : '<server-error>' };
    }
    const ids = await idMap();
    results.push({ step: `${step.actor}:${step.action}`, outcome: normalize(outcome, ids),
      cookieUser: normalize(await cookieSession(jar), ids) });
  }

  await new Promise(r => setTimeout(r, 2500)); // let fire-and-forget emails finish
  const ids = await idMap();
  const users = (await prisma.user.findMany({ orderBy: { email: 'asc' } })).map(u => normalize({
    email: u.email, name: u.name, role: u.role, phone: u.phone, cityId: u.cityId, managerId: u.managerId,
    pincodes: u.pincodes, hasResetToken: u.resetToken !== null }, ids));
  const res = await fetch(`http://${process.env.MAILPIT_HOST}:8025/api/v1/messages?limit=500`);
  const mails = (await res.json()).messages.map((m: any) => `${m.To.map((t: any) => t.Address).join(',')}|${m.Subject}`).sort();
  writeFileSync(process.argv[3], JSON.stringify({ steps: results, users, mails }, null, 1));
  console.log('steps:', results.length, 'users:', users.length, 'mails:', mails.length);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
