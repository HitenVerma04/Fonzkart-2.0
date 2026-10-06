// Executes backend/src/test/resources/golden/staff-scenario.json against the website code and writes the expected
// outcome that StaffScenarioParityTest replays against Spring Boot. Server actions are called directly; pages are
// rendered behind the real admin layout, recording the props they pass to their components and invoking the inline
// 'use server' closures found in the rendered tree.
//   tsx scripts/security-tests/staff-ref.ts <scenario.json> <expected.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { jwtVerify } from 'jose';
import * as auth from '@/actions/auth';
import * as admin from '@/actions/admin';
import * as cityActions from '@/app/admin/cities/actions';
import * as executive from '@/actions/executive';
import { checkPincodeAvailability } from '@/actions/orders';
import { verifyExecutiveToken } from '@/lib/executive-session';
import { isRiderPasswordHash } from '@/lib/rider-password';
import RidersPage from '@/app/admin/riders/page';
import CitiesPage from '@/app/admin/cities/page';
import ZonalHeadsPage from '@/app/admin/zonal-heads/page';
import RmDashboardPage from '@/app/admin/rm-dashboard/page';
import HomepagePage from '@/app/admin/homepage/page';
import HomePage from '@/app/page';
import AdminsPage from '@/app/admin/admins/page';
import RiderManager from '@/components/admin/RiderManager';
import CityCard from '@/components/admin/CityCard';
import RMPartnerView from '@/components/admin/RMPartnerView';
import CityOrderCard from '@/components/admin/CityOrderCard';
import AdminManager from '@/components/admin/AdminManager';
import { HomeClient } from '@/components/HomeClient';
import { adminPage, as, find, form, prisma, propsOf } from './harness';

const KEY = new TextEncoder().encode(process.env.AUTH_SECRET!);
const KNOWN_THROWN = ['Unauthorized', 'Forbidden: Admin access required',
  'Forbidden: Insufficient privileges to grant executive access', 'Forbidden: Outside your assigned cities',
  'Forbidden: Outside your team', "Forbidden: Cannot change this user's role"];
const DROP = new Set(['createdAt', 'updatedAt', 'passwordHash', 'resetToken', 'resetTokenExpiry', 'password']);

class Unavailable extends Error {}

const jar = () => (globalThis as any).__jar as Map<string, any>;

// ---------------------------------------------------------------- ids and normalization
async function labels() {
  const m = new Map<string, string>();
  for (const u of await prisma.user.findMany({ select: { id: true, email: true } })) m.set(u.id, `<user:${u.email}>`);
  for (const r of await prisma.rider.findMany({ select: { id: true, phone: true } })) m.set(r.id, `<rider:${r.phone}>`);
  for (const c of await prisma.city.findMany({ select: { id: true, name: true } })) m.set(c.id, `<city:${c.name}>`);
  return m;
}
function normalize(v: any, ids: Map<string, string>): any {
  if (Array.isArray(v)) return v.map(x => normalize(x, ids));
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const out: any = {};
    for (const [k, x] of Object.entries(v)) if (!DROP.has(k) && x !== undefined) out[k] = normalize(x, ids);
    return out;
  }
  if (typeof v === 'string' && ids.has(v)) return ids.get(v);
  return v;
}
async function resolve(input: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (typeof v === 'string' && v.startsWith('$user:')) out[k] = (await prisma.user.findFirst({ where: { email: v.slice(6) } }))?.id ?? 'NO-ID';
    else if (typeof v === 'string' && v.startsWith('$rider:')) out[k] = (await prisma.rider.findFirst({ where: { phone: v.slice(7) } }))?.id ?? 'NO-ID';
    else if (typeof v === 'string' && v.startsWith('$city:')) out[k] = (await prisma.city.findFirst({ where: { name: v.slice(6) } }))?.id ?? 'NO-ID';
    else if (v === '$session') out[k] = jar().get('session')?.value ?? '';
    else out[k] = v;
  }
  return out;
}
/** Rider passwords are compared by kind only: bcrypt hashes are salted, so their values differ on every run. */
const passwordState = (p: string | null) => (p === null ? null : p === '' ? 'empty' : isRiderPasswordHash(p) ? 'hashed' : 'plain');

// ---------------------------------------------------------------- actions and pages
async function renderAsSuper(page: () => Promise<any>) {
  const caller = jar();
  as('super');
  try { return await adminPage(page); } finally { (globalThis as any).__jar = caller; }
}

async function invoke(action: string, i: any) {
  switch (action) {
    case 'signin': return auth.signin(null, form(i));
    case 'setCookie': jar().set(i.name, { value: i.value, opts: {} }); return null;
    case 'updateCityPincodes': return cityActions.updateCityPincodes(i.cityId, i.pincodes);
    case 'toggleCityActive': return cityActions.toggleCityActive(i.cityId, i.isActive);
    case 'updatePartnerPincodes': return cityActions.updatePartnerPincodes(i.partnerId, i.pincodes);
    case 'removePartnerFromCity': return cityActions.removePartnerFromCity(i.partnerId);
    case 'toggleFeaturedCity': return admin.toggleFeaturedCity(i.id, i.isFeatured);
    case 'updateCityDisplayOrder': return admin.updateCityDisplayOrder(i.id, i.order);
    case 'checkPincodeAvailability': return checkPincodeAvailability(i.pincode);
    case 'addRider': return admin.addRider(i.name, i.phone, i.email || undefined, i.partnerId || undefined);
    case 'deleteRider': return admin.deleteRider(i.id);
    case 'updateRiderPartner': return admin.updateRiderPartner(i.riderId, i.partnerId);
    case 'addFieldExecutive': return admin.addFieldExecutive(i.email);
    case 'loginExecutive': return executive.loginExecutive(i.phone, i.password);
    case 'onboardExecutive': return executive.onboardExecutive(i.id, i.password);
    case 'logoutExecutive': return executive.logoutExecutive();
    case 'getExecutiveSession': return executive.getExecutiveSession();
    case 'getAdmins': return admin.getAdmins();
    case 'addAdmin': return admin.addAdmin(i.email);
    case 'addZonalHead': return admin.addZonalHead(i.email);
    case 'addRelationshipManager': return admin.addRelationshipManager(i.email);
    case 'addPartner': return admin.addPartner(i.email, i.cityId, i.managerId);
    case 'removeAdmin': return admin.removeAdmin(i.email);
    case 'removeUserRole': return admin.removeUserRole(i.email);
    case 'updatePartnerManager': return admin.updatePartnerManager(i.partnerId, i.managerId);
    case 'getPartnersManagedBy': return admin.getPartnersManagedBy(i.managerId);
    case 'upsertEvaluationRule': return admin.upsertEvaluationRule(i);

    // Inline page actions: the form is taken from the page as the super admin sees it and then submitted by the
    // step's actor — as when a server action is called directly — so the action's own check decides.
    case 'registerHub': {
      const tree = await renderAsSuper(() => CitiesPage());
      const f = find(tree, e => e.type === 'form' && find(e.props.children, c => c.props?.name === 'cityName').length > 0)[0];
      return f.props.action(form(i));
    }
    case 'zhAssignCity': case 'zhUnassignCity': {
      const tree = await renderAsSuper(() => ZonalHeadsPage());
      const card = find(tree, e => e.key === i.zonalHeadId)[0];
      if (!card) throw new Unavailable();
      if (action === 'zhAssignCity') {
        const f = find(card, e => e.type === 'form' && find(e.props.children, c => c.type === 'select' && c.props?.name === 'cityId').length > 0)[0];
        return f.props.action(form({ cityId: i.cityId }));
      }
      const chip = find(card, e => e.key === i.cityId && e.type === 'div')[0];
      if (!chip) throw new Unavailable();
      return find(chip, e => e.type === 'form')[0].props.action(new FormData());
    }

    case 'page:cities': {
      const cards = propsOf(await adminPage(() => CitiesPage()), CityCard);
      return { cities: cards.map(p => ({ ...p.city, zonalHeads: p.zonalHeads, partners: p.partners })),
        isZonalHead: cards.length ? cards[0].isZonalHead : null };
    }
    case 'page:riders': {
      const p = propsOf(await adminPage(() => RidersPage()), RiderManager)[0];
      return { riders: p.initialRiders, partners: p.partners, currentUserRole: p.currentUserRole, currentUserId: p.currentUserId };
    }
    case 'page:rm-dashboard': {
      const p = propsOf(await adminPage(() => RmDashboardPage()), RMPartnerView)[0];
      return { partners: p.partners, totalDelayed: p.partners.reduce((a: number, x: any) => a + x.delayedOrders.length, 0) };
    }
    case 'page:homepage': return propsOf(await adminPage(() => HomepagePage()), CityOrderCard).map(p => p.city);
    case 'page:home': return propsOf(await HomePage(), HomeClient)[0].activeCities;
    case 'page:admins': {
      const p = propsOf(await adminPage(() => AdminsPage()), AdminManager)[0];
      return { superAdmins: p.superAdmins, admins: p.admins, zonalHeads: p.zonalHeads,
        relationshipManagers: p.relationshipManagers, partners: p.partners, riders: p.riders };
    }
    default: throw new Error('unknown action ' + action);
  }
}

async function jarState() {
  const j = jar();
  let session: any = null;
  const s = j.get('session');
  if (s?.value) { try { session = (await jwtVerify(s.value, KEY, { algorithms: ['HS256'] })).payload.user ?? 'INVALID'; } catch { session = 'INVALID'; } }
  const e = j.get('executive_id')?.value;
  const executiveId = e ? await verifyExecutiveToken(e) : null;
  return { session, executive: e ? (executiveId ?? 'INVALID') : null };
}

async function main() {
  const scenario = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const results: any[] = [];
  for (const step of scenario.steps) {
    as(step.actor);
    const input = await resolve(step.input);
    let outcome: any;
    try {
      outcome = { returned: (await invoke(step.action, input)) ?? null };
    } catch (e: any) {
      if (e instanceof Unavailable) outcome = { unavailable: true };
      else if (e?.digest === 'NEXT_REDIRECT') outcome = step.action.startsWith('page:') ? { denied: true } : { redirect: e.url };
      else outcome = { thrown: KNOWN_THROWN.includes(e?.message) ? e.message : '<server-error>' };
    }
    const ids = await labels();
    results.push({ step: `${step.actor}:${step.action}`, outcome: normalize(outcome, ids), jar: normalize(await jarState(), ids) });
  }
  const ids = await labels();
  const snapshot = normalize({
    users: (await prisma.user.findMany({ orderBy: { email: 'asc' } })).map(u => ({ email: u.email, role: u.role, cityId: u.cityId, pincodes: u.pincodes, managerId: u.managerId, relationshipManagerId: u.relationshipManagerId })),
    riders: (await prisma.rider.findMany({ orderBy: { phone: 'asc' } })).map(r => ({ name: r.name, phone: r.phone, email: r.email, status: r.status, passwordState: passwordState(r.password), partnerId: r.partnerId })),
    cities: (await prisma.city.findMany({ orderBy: { name: 'asc' } })).map(c => ({ name: c.name, isActive: c.isActive, pincodes: c.pincodes, displayOrder: c.displayOrder, isFeatured: c.isFeatured, managerId: c.managerId })),
    orders: (await prisma.order.findMany({ orderBy: { id: 'asc' } })).map(o => ({ id: o.id, riderId: o.riderId, partnerId: o.partnerId })),
  }, ids);
  writeFileSync(process.argv[3], JSON.stringify({ steps: results, snapshot }, null, 1));
  console.log('steps:', results.length);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
