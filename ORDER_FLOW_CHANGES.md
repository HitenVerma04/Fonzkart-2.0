# Order flow — price approval, relationship managers, customer tracker, payouts (2026-10-06)

Nothing has been deployed. The database change is additive (two new nullable columns) and is applied by the new
Prisma migration when the app is next deployed (see "Deploying" below).

## 1. What changed, in plain words

| Area | Before | Now |
|---|---|---|
| **Revised price** | The executive could change the price and mark the device picked up immediately. The "approval" screen existed but was never reached. | If the executive's price differs from the quoted price, the order waits in **Price review**. The partner, the partner's RM, the zonal head or an admin approves (optionally at another price) or rejects with a reason. Only after approval can the executive pay and collect the device. The same price goes straight to "Picked up", as before. |
| **Routing** | Every partner covering a pincode was notified; nobody "owned" an order. | A new order is **routed to one partner**: the partner whose pincodes include the order's pincode (if several, the longest-registered one). That partner and their RM are notified (plus admins and zonal heads, as before). No partner for the pincode: the order stays unrouted and every RM is notified. |
| **Relationship managers** | Linked to nothing; the RM dashboard showed every partner. | Each partner can have an RM (`relationshipManagerId`). An RM sees the orders of their partners plus unrouted orders, can (re)assign the partner, assign one of their partners' executives, approve prices, fail/restore orders, record payouts and contact the customer (call / WhatsApp / email links). The RM dashboard shows only their partners. A partner an RM registers becomes theirs. Admins and zonal heads choose a partner's RM on the Partners page. |
| **Executive assignment** | Anyone with a staff role could assign any executive to any order. | Admins: any executive. Zonal heads, RMs and partners: only executives of their own partners. The order follows the executive's partner. Only before the device is collected. |
| **Payouts** | The chosen method (cash, UPI, bank transfer, Amazon / Flipkart gift card) was stored; nothing recorded that the customer was actually paid. | After pickup, the executive (or staff) taps **Mark payout paid** with an optional reference (transaction or gift-card order ID — never the gift card code). Recorded once: method, amount, reference, date, who. Shown to the customer, the executive and the admin panel; included in the CSV export. |
| **Customer tracker** | 4 steps; "RM Assigned" lit up when an executive was assigned; picked-up and failed orders showed step 1. | Steps from the stored data: Order placed → Partner assigned → Executive assigned → (Price review, only when it happened) → Picked up → Payment → Delivered to hub. Failed orders show where it stopped and why. Shows the executive's name and phone, the revised / final price against the quote, and the payment status. The admin panel's order details use the same tracker. |
| **Admin panel** | Status names were raw codes. | Shared status names everywhere (`lib/order-status.ts`), a **Price Approval** tab with a live count, partner shown on every order with a reassign control, payout panel, and only the buttons the signed-in role may use (the server enforces the same rules). |

## 2. Who may do what with an order

| | Admin | Zonal head | RM | Partner | Executive |
|---|---|---|---|---|---|
| Sees | all | team partners' orders + territory (as before) | their partners' + unrouted | routed to them + unrouted legacy orders in their pincodes | assigned to them |
| Route to a partner | any | team | their partners | — | — |
| Assign executive | any | team's | their partners' | own | — |
| Approve / reject price | ✓ | ✓ | ✓ | ✓ | — |
| Fail, restore, hub handover, mark paid | ✓ | ✓ | ✓ | ✓ | fail own open order; mark own order paid |
| Bulk fail / restore / hub | ✓ | ✓ | ✓ | — | — |
| Delete (single or bulk) | ✓ | ✓ (their orders) | — | — | — |

Every action also requires the order to be one the caller sees (otherwise `Forbidden: Outside your orders`) and the
order's status to allow it (otherwise HTTP 400 / `Invalid: …`). Previously the order API and actions checked only the
role, so e.g. any partner could approve, fail or delete any order, and any executive could change any order.

## 3. Files

New:
- `lib/order-status.ts` — statuses, names, tracker steps, payout and price-review helpers (shared by every screen).
- `lib/order-access.ts` — which orders, partners and executives each role may see and act on.
- `lib/order-workflow.ts` — every order state change (routing, assignment, price review, fail/restore, hub, payout).
- `prisma/migrations/20261006000000_order_partner_and_rm/migration.sql`
- `scripts/security-tests/orders.test.ts` (17 tests).

Changed (website): `prisma/schema.prisma`, `lib/store.ts`, `actions/admin.ts`, `actions/executive.ts`,
`actions/orders.ts`, `app/api/admin/orders/[id]/route.ts`, `app/api/admin/orders/bulk/route.ts`,
`app/admin/orders/page.tsx`, `app/admin/rm-dashboard/page.tsx`, `app/admin/partners/page.tsx`,
`app/admin/admins/page.tsx` (one field), `components/admin/OrderManager.tsx`, `components/admin/RiderOrderList.tsx`,
`components/admin/VerificationModal.tsx`, `components/admin/RMPartnerView.tsx` (empty-state text),
`components/orders/OrderCard.tsx`, `components/orders/OrderStepper.tsx`.

Changed (Spring Boot, which ports the RM dashboard and Partners page): `User` entity (`relationshipManagerId`),
`OrderRecord` (`partnerId`), `UserDto`, `OrderRecordDto`, `AppOrderDto`/`AppOrderMapper` (`partnerId`),
`RelationshipManagerDashboardService` (own partners only), `PartnerAdminService` + `StaffController` +
`UserViews` (RM per partner), `StaffRoleService.addPartner` (RM's new partner is theirs), `StaffDirectoryService`,
`UserRepository`. Test resources: `db/01-prisma-schema.sql` (regenerated by Prisma), `db/03-staff-seed.sql`
(Rita is RM of Partners One and Two), golden files regenerated from the website.

Pre-change copies of every edited file: `order-flow/originals/`.

## 4. Data kept on an order

New columns: `"Order"."partnerId"` and `"User"."relationshipManagerId"` (both nullable, `ON DELETE SET NULL`).
In the order's existing `answers` JSON: `priceReview` (quoted / requested / approved price, decision, when, by
which role, reason), `quotedPrice` (kept once an approved revision replaced the price), `payout` (status, method,
amount, reference, paidAt, paidBy), `routingLog`. Logs record the actor's role and id, never an email address,
because customers can read their own order's data.

## 5. Behaviour notes

- Approving a revised price no longer marks the order picked up: it returns to the executive at the approved price,
  who then confirms the pickup ("Confirm Pickup at ₹…"). This is what makes the approval happen *before* pickup.
- Orders placed before this change have no partner. They stay visible to admins, zonal heads (territory), every
  RM, and the partners covering their pincode, exactly as before, until someone assigns a partner or an executive.
- Partners have no RM until an admin (or zonal head) sets one on the Partners page; until then their orders are
  visible to admins and zonal heads, and RMs only see them while unrouted.
- The executive "Fail" button is shown only on open orders; staff "Delete" only to admins and zonal heads.

## 6. Tests

- Website: `bash scripts/security-tests/run.sh test` → 54/54 (37 earlier + 17 new). Mutation checks: each key
  rule was broken in turn (scope bypass, routing/assignment outside the team, the approval gate, pickup during
  review, paying twice, executive ownership, unscoped bulk, unscoped RM dashboard) and the suite failed every time.
- Spring Boot: `mvn -o clean verify` → 118 tests, 0 failures (incl. a new RM test in `StaffAdminIntegrationTest` and the 158-step parity scenario, which now also compares `relationshipManagerId` and `partnerId`).
- TypeScript: `tsc --noEmit` over the whole website (strict) → 0 errors, before and after.

## 7. Deploying (later, with Coolify)

1. Deploy the code. The app's start script (`package.json` → `prisma db push --accept-data-loss`) adds the two
   columns on first start; the change is additive, so nothing is dropped. For a migration-managed database, apply
   `prisma/migrations/20261006000000_order_partner_and_rm/migration.sql` instead. (Worth revisiting separately:
   `--accept-data-loss` on every start would silently drop columns if a future schema edit removed one.)
2. If the Spring Boot service is deployed too: only after the columns exist — it validates its mappings against the
   database at startup (`ddl-auto: validate`) and refuses to start without `"Order"."partnerId"` and
   `"User"."relationshipManagerId"`.
3. On the Partners page, assign each partner's RM.
4. No data backfill is required; existing orders keep working through the pincode fallback.

## 8. Follow-up: notifications (2026-10-06)

Before: the notification actions took the caller's role and user id **from the browser**, so anyone could read any
user's or role's notifications (order numbers, devices, prices, pincodes), mark them read, or create notifications
for everyone; executives' notifications also showed up as "system-wide" for all staff; the "order waiting" count
covered all orders for any signed-in user.

Now (`actions/notifications.ts`): the caller is identified from the session and database; staff see notifications
addressed to them, to their role, and real system-wide ones (not executives'); customers and visitors get none;
mark-read works only on the caller's notifications; `createNotification` is no longer callable from the browser —
the header's "Pulse Test" uses `sendPulseTest()`, which notifies only the person who pressed it. The buzzer count
(`/api/admin/orders/unassigned-count`) counts only orders the caller sees (lib/order-access.ts).

Tests: `scripts/security-tests/notifications.test.ts` (4 tests; all 4 fail against the old code). Full website
suite 58/58; `tsc --noEmit` 0 errors. Pre-change copies: `notifications-fix/originals/`.

Not checkable from this repository: the admin panel also receives new notifications live through Supabase Realtime
(`components/NotificationProvider.tsx` subscribes to every INSERT on "Notification" with the public anon key and
filters in the browser). Whether that leaks notifications depends on the Supabase project's settings — whether the
table is in the `supabase_realtime` publication and has row-level security. Check this in the Supabase dashboard
before relying on it; if the table is published without RLS, anyone with the site's public key can listen to all
notifications.
