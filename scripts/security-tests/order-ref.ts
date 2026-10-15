// Executes backend/src/test/resources/golden/order-scenario.json against the website code and writes the expected
// outcome that OrderScenarioParityTest replays against Spring Boot. Server actions and the admin order routes are
// called directly; the Orders page is rendered behind the real admin layout and the props it passes to OrderManager
// are recorded.
//   tsx scripts/security-tests/order-ref.ts <scenario.json> <expected.json>
import { readFileSync, writeFileSync } from 'node:fs';
import * as admin from '@/actions/admin';
import * as orders from '@/actions/orders';
import * as executive from '@/actions/executive';
import * as notifications from '@/actions/notifications';
import { findVariantByName } from '@/actions/catalog';
import { calculatePrice } from '@/actions/priceCalculation';
import { POST as orderRoute, DELETE as orderDeleteRoute } from '@/app/api/admin/orders/[id]/route';
import { POST as bulkRoute } from '@/app/api/admin/orders/bulk/route';
import { GET as unassignedRoute } from '@/app/api/admin/orders/unassigned-count/route';
import OrdersPage from '@/app/admin/orders/page';
import OrderManager from '@/components/admin/OrderManager';
import * as auth from '@/actions/auth';
import { adminPage, as, form, prisma, propsOf } from './harness';

const KNOWN_THROWN = ['Unauthorized', 'Forbidden: Admin access required', 'Forbidden: Outside your orders',
  'Forbidden: Outside your partners and executives', "Invalid: Not possible in the order's current status",
  'Order not found', 'Forbidden: Not your order', 'Invalid: Not a partner', 'Invalid: Executive not found',
  'Invalid: Price', 'Invalid: Payout already recorded', 'Invalid: Hub status', 'Invalid: Status'];
const DROP = new Set(['createdAt', 'updatedAt', 'passwordHash', 'resetToken', 'resetTokenExpiry', 'password']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The category the sell flow prices a model with (same mapping as CustomerOrderService.sellCategory). */
function sellCategory(c: string | null | undefined): string {
  const k = (c || '').trim().toLowerCase();
  const aliases: Record<string, string> = { mobile: 'smartphone', ipad: 'tablet', smartwatch: 'watch', tv: 'smarttv' };
  return aliases[k] ?? (k || 'smartphone');
}

async function labels() {
  const m = new Map<string, string>();
  for (const u of await prisma.user.findMany({ select: { id: true, email: true } })) m.set(u.id, `<user:${u.email}>`);
  for (const r of await prisma.rider.findMany({ select: { id: true, phone: true } })) m.set(r.id, `<rider:${r.phone}>`);
  for (const c of await prisma.city.findMany({ select: { id: true, name: true } })) m.set(c.id, `<city:${c.name}>`);
  for (const o of await prisma.order.findMany({ select: { id: true, orderNumber: true } })) m.set(o.id, `<order:#${o.orderNumber}>`);
  return m;
}
function normalize(v: any, ids: Map<string, string>): any {
  if (Array.isArray(v)) return v.map(x => normalize(x, ids));
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const [k, x] of Object.entries(v)) if (!DROP.has(k) && x !== undefined) out[k] = normalize(x, ids);
    return out;
  }
  if (typeof v === 'string' && ids.has(v)) return ids.get(v);
  if (typeof v === 'string' && ISO_DATE.test(v)) return '<date>';
  if (typeof v === 'string' && UUID.test(v)) return '<deleted-order>'; // a random order id no longer in the database
  return v;
}
const plain = (v: any) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

async function resolve(v: any): Promise<any> {
  if (Array.isArray(v)) return Promise.all(v.map(resolve));
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const [k, x] of Object.entries(v)) out[k] = await resolve(x);
    return out;
  }
  if (typeof v === 'string' && v.startsWith('$user:')) return (await prisma.user.findFirst({ where: { email: v.slice(6) } }))?.id ?? 'NO-ID';
  if (typeof v === 'string' && v.startsWith('$rider:')) return (await prisma.rider.findFirst({ where: { phone: v.slice(7) } }))?.id ?? 'NO-ID';
  if (typeof v === 'string' && v.startsWith('$order:#')) return (await prisma.order.findFirst({ where: { orderNumber: Number(v.slice(8)) } }))?.id ?? 'NO-ID';
  return v;
}

async function route(res: Response) {
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* plain text */ }
  return { status: res.status, body };
}

/** Notifications without their random ids; compared as a set (sortNotifications, after ids become labels). */
const withoutIds = (list: any[]) => list.map(({ id, ...n }: any) => n);
const notificationKey = (n: any) => [n.title, n.message, n.type, n.userId, n.role, n.riderId, n.orderId, n.isRead].map(String).join('|');
const byJson = (a: any, b: any) => { const x = notificationKey(a), y = notificationKey(b); return x < y ? -1 : x > y ? 1 : 0; };
const sortNotifications = (list: any[]) => [...list].sort(byJson);

async function invoke(action: string, i: any) {
  switch (action) {
    case 'signin': return auth.signin(null, form(i));
    case 'loginExecutive': return executive.loginExecutive(i.phone, i.password);
    case 'onboardExecutive': return executive.onboardExecutive(i.id, i.password);
    case 'placeOrder': {
      const v: any = await findVariantByName(`${i.device} (${i.variant})`);
      const price = await calculatePrice(v.basePrice, i.answers ?? {}, sellCategory(v.model?.category));
      return orders.placeOrder(i.device, i.variant, price, i.address, i.pincode, i.location, i.answers);
    }
    case 'getUserOrders': return orders.getUserOrders();
    case 'page:orders': {
      const p = propsOf(await adminPage(() => OrdersPage({} as any)), OrderManager)[0];
      return { initialOrders: p.initialOrders, riders: p.riders, partners: p.partners, permissions: p.permissions, userRole: p.userRole };
    }
    case 'assignPartner': return admin.assignPartner(i.orderId, i.partnerId);
    case 'assignRider': return admin.assignRider(i.orderId, i.riderId);
    case 'markPayoutPaid': return admin.markPayoutPaid(i.orderId, i.reference);
    case 'getExecutiveOrders': return executive.getExecutiveOrders();
    case 'updateOrderStatus': return executive.updateOrderStatus(i.orderId, i.status, i.reason);
    case 'submitVerification': return executive.submitVerification(i.orderId, i.payload);
    case 'markPayoutPaidByExecutive': return executive.markPayoutPaidByExecutive(i.orderId, i.reference);
    case 'getNotifications': {
      const r: any = await notifications.getNotifications();
      return r.notifications ? { ...r, notifications: withoutIds(plain(r.notifications)) } : r;
    }
    case 'markAllAsRead': return notifications.markAllAsRead();
    case 'route:order': return route(await orderRoute(new Request('http://test/api/admin/orders/' + i.orderId,
      { method: 'POST', body: JSON.stringify(i.body) }), { params: Promise.resolve({ id: i.orderId }) }));
    case 'route:delete': return route(await orderDeleteRoute(new Request('http://test/api/admin/orders/' + i.orderId,
      { method: 'DELETE' }), { params: Promise.resolve({ id: i.orderId }) }));
    case 'route:bulk': return route(await bulkRoute(new Request('http://test/api/admin/orders/bulk',
      { method: 'POST', body: JSON.stringify(i.body) })));
    case 'route:unassignedCount': return route(await unassignedRoute());
    default: throw new Error('unknown action ' + action);
  }
}

const parsed = (text: string | null) => {
  if (text === null) return null;
  try { return JSON.parse(text); } catch { return text; }
};

async function main() {
  const scenario = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const results: any[] = [];
  for (const step of scenario.steps) {
    as(step.actor);
    const input = await resolve(step.input);
    let outcome: any;
    try {
      outcome = { returned: plain(await invoke(step.action, input)) };
    } catch (e: any) {
      if (e?.digest === 'NEXT_REDIRECT') outcome = step.action.startsWith('page:') ? { denied: true } : { redirect: e.url };
      else outcome = { thrown: KNOWN_THROWN.includes(e?.message) ? e.message : '<server-error>' };
    }
    const normalized = normalize(outcome, await labels());
    if (step.action === 'getNotifications' && Array.isArray(normalized.returned?.notifications)) {
      normalized.returned.notifications = sortNotifications(normalized.returned.notifications);
    }
    results.push({ step: `${step.actor}:${step.action}`, outcome: normalized });
  }
  const ids = await labels();
  const snapshot = normalize({
    orders: (await prisma.order.findMany({ orderBy: { orderNumber: 'asc' } })).map(o => ({
      orderNumber: o.orderNumber, userId: o.userId, riderId: o.riderId, partnerId: o.partnerId, device: o.device,
      price: o.price, status: o.status, pincode: o.pincode, address: o.address, locationLat: o.locationLat,
      locationLng: o.locationLng, offeredPrice: o.offeredPrice, answers: parsed(o.answers),
      riderAnswers: parsed(o.riderAnswers), verificationImages: o.verificationImages,
    })),
    notifications: withoutIds((await prisma.notification.findMany()).map(n => ({
      id: n.id, userId: n.userId, role: n.role, riderId: n.riderId, title: n.title, message: n.message, type: n.type,
      orderId: n.orderId, isRead: n.isRead,
    }))),
  }, ids);
  snapshot.notifications = sortNotifications(snapshot.notifications);
  writeFileSync(process.argv[3], JSON.stringify({ steps: results, snapshot }, null, 1) + '\n');
  console.log('steps:', results.length);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
