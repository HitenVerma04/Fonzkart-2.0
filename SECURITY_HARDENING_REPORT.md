# Fonzkart — Critical Security Hardening

> **Dates:** 2026-10-04 (Part 1, sections 1–6) and 2026-10-05 (Part 2: staff permissions, section 8).
> **Scope:** the critical findings in `backend/README.md` (debug endpoint, city/partner pincodes, rider passwords,
> rider cookie), then the over-broad staff "admin" check. **Order migration was not started.**
> **Status:** code changed and tested in both the website (Next.js) and the new backend (Spring Boot).
> **Nothing has been deployed** and the production database was not touched. Remaining issues: section 7.

---

## 1. What was wrong, and where

The live website was affected by more than the new backend: every item below except the onboarding take-over is
exploitable on the live site today, until this change is deployed.

| # | Problem | Live website | New backend (not live) | Severity |
|---|---|---|---|---|
| A | **Admin pages sent every user's password hash and pending password-reset code to the browser** (found during this review). Any staff role that can open the admin panel — including PARTNER and FIELD_EXECUTIVE — could request a reset for any account (even a super admin), read the 6-digit code from the page data and take the account over. | Yes | No (never returned these fields) | **Critical** |
| B | **`/api/diagnose-user` returned the full user record**, including password hash and reset code: to anyone holding `INTERNAL_API_KEY` in production, and to **anyone at all** outside production. | Yes | Not ported | **High** |
| C | **The `executive_id` cookie held the raw rider id, unsigned.** Writing a rider's id into it impersonated that rider; the field-executive order actions (`updateOrderStatus`, `submitVerification`) trusted it. | Yes | Yes | **High** |
| D | **City and partner pincode actions had no access check.** Anyone could switch cities off, rewrite service pincodes, or move partners out of their territory. "Register Hub" (inline action) had no check either. | Yes | Yes | **High** |
| E | **Rider passwords stored in plain text**, and also sent to the browser on the riders, admins, orders and RM-dashboard pages. | Yes | Yes (storage) | **High** |
| F | **Onboarding could overwrite any rider's password** (`onboardExecutive` / `POST /api/executive/onboard`), then sign in as that rider. | Probably not reachable today (no page uses the action, and Next.js only exposes server actions that pages use) — fixed anyway | Yes (public endpoint) | **Critical** if reachable |

## 2. What was fixed

**A — Secrets no longer reach the browser.** The five admin pages that pass user or rider records to browser
components (riders, admins, cities, orders, RM dashboard) now strip `passwordHash`, `resetToken`,
`resetTokenExpiry` and the rider `password` first (`lib/safe-records.ts`). Nothing visible changes.

**B — Debug endpoint secured.** `/api/diagnose-user` now needs a signed-in SUPER_ADMIN, checked against the
database, in every environment. The old `?key=` alone no longer works. The response shows yes/no flags
(`hasPassword`, `hasPendingResetCode`) instead of the hash and code.

**C — Rider cookie can no longer be forged.** `executive_id` now holds a signed token (HS256, rider id inside, valid
7 days). The signing key is derived from `AUTH_SECRET` with a fixed label, so a normal user-session cookie can't be
used as a rider cookie or the other way round. Raw ids, edited, expired or wrongly signed tokens are ignored; a real
field executive with a forged cookie still only gets their own rider record. Both backends produce byte-identical
tokens, so either accepts the other's cookie.

**D — City and partner changes need the right role and territory**, read from the database on every call (a
demoted user's still-valid cookie no longer works):

| Action | Allowed |
|---|---|
| Change a city's pincodes | SUPER_ADMIN, ADMIN; ZONAL_HEAD for their own city and the cities they manage |
| Switch a city on/off | SUPER_ADMIN, ADMIN (the page already hid this from zonal heads) |
| Change / remove a partner's pincodes | SUPER_ADMIN, ADMIN; ZONAL_HEAD for partners in their cities or managed by them |
| Register Hub | SUPER_ADMIN, ADMIN, ZONAL_HEAD (the roles the Cities page is for) |

Everyone else gets 401 `Unauthorized` or 403 `Forbidden: Admin access required` / `Forbidden: Outside your assigned
cities`, and nothing is written.

**E — Rider passwords are hashed** with bcrypt, the same format and cost as user passwords. Existing plain-text
passwords keep working: on the next successful login the password is replaced by its hash. A one-time script
converts the rest (see section 5).

**F — Onboarding sets a first password only.** It is refused when the rider already has a password, and for an
empty password; the password is stored hashed.

## 3. Files changed

### Website (server-side files only — no UI component was changed)

| File | Change |
|---|---|
| `actions/executive.ts` | hashed passwords with legacy upgrade, onboarding guard, signed cookie, no password in returned rider |
| `app/admin/cities/actions.ts` | role/territory checks on all four actions |
| `app/admin/cities/page.tsx` | role check in the "Register Hub" action; secrets stripped from component data |
| `app/api/diagnose-user/route.ts` | SUPER_ADMIN only; no hash or reset code in the response |
| `app/admin/admins/page.tsx`, `riders/page.tsx`, `orders/page.tsx`, `rm-dashboard/page.tsx` | secrets stripped from component data |
| `lib/executive-session.ts` (new) | signed rider token |
| `lib/rider-password.ts` (new) | bcrypt hashing with legacy plain-text verification |
| `lib/staff-access.ts` (new) | database-role checks for city/partner actions |
| `lib/safe-records.ts` (new) | removes secret fields before data reaches the browser |
| `scripts/hash-rider-passwords.ts` (new) | optional one-time conversion of plain-text rider passwords |
| `scripts/security-tests/` (new) | regression tests (Docker) and the parity-fixture generator |
| `security-hardening/originals/` (new) | the eight original files, unchanged, for review and rollback |

### Spring Boot backend (`backend/`)

| File | Change |
|---|---|
| `auth/session/ExecutiveTokenCodec.java`, `ExecutiveSessions.java` (new) | signed `executive_id` token and cookie |
| `rider/service/RiderPasswords.java` (new) | bcrypt with legacy upgrade |
| `rider/service/ExecutiveAuthService.java` | uses both; onboarding guard |
| `city/service/CityAccess.java` (new), `CityAdminService.java`, `city/api/CityController.java` | role/territory checks |
| `rider/entity/Rider.java`, `rider/api/ExecutiveController.java`, `README.md` | documentation |
| Tests: `ExecutiveTokenCodecTest`, `RiderPasswordsTest`, `SecurityHardeningIntegrationTest` (new); `StaffScenarioParityTest`, `StaffAdminIntegrationTest` (updated) | |
| `golden/staff-scenario.json` (+30 steps), `staff-scenario-expected.json` (regenerated from the fixed website), `executive-token-fixture.json` (new) | |

## 4. Does the website need changes?

**Yes — they have been made** (section 3) and must be **deployed** to protect the live site. There are no UI
changes and no new environment variables; the new code uses the existing `AUTH_SECRET`.

No coordination with the Spring Boot backend is needed yet: the website does not call it. When Spring endpoints
are switched on later, both sides already share the cookie format, key and password format (proved by tests).

## 5. Effect on existing users, sessions and data

- **Database:** no schema change, no migration needed. The website keeps working on the existing data.
- **Customers and staff:** nobody is logged out; user sessions are unchanged.
- **Field executives:** they sign in with their normal account (unchanged). Only someone holding an old
  `executive_id` cookie from the separate rider login must log in once more (no page currently links to that login).
- **Rider passwords:** unchanged for the riders. Each one is stored as a hash after its next successful login.
  Optionally convert the rest now, after a database backup:
  ```bash
  npx tsx scripts/hash-rider-passwords.ts
  ```
  ```bash
  npx tsx scripts/hash-rider-passwords.ts --apply
  ```
  The first is a dry run (counts only); the second converts. It is safe to re-run, never prints passwords, and
  skips empty values (meaning "needs onboarding").
- **Zonal heads:** can no longer change cities or partners outside their territory. **Partners, relationship
  managers and field executives** can no longer use these actions (they were only reachable by typing the URL).
- **`/api/diagnose-user`:** whoever used `?key=` must sign in as a super admin instead.

### Rollout

1. Take a database backup (execution plan SEC-00).
2. Deploy the website build containing all files in section 3 together.
3. Optional: run the conversion script (dry run first).
4. Rollback = restore the files from `security-hardening/originals/`. **Caution:** the old code compares rider
   passwords as plain text, so after rolling back, riders whose password was already converted to a hash could not
   use the rider phone login until onboarded again. Normal account sign-in is unaffected.

## 6. Test results

| Suite | Result |
|---|---|
| Website security tests (`scripts/security-tests/run.sh test`) | **22 / 22 passed** |
| Same tests against the original website code (`run.sh originals`) | **17 / 22 failed, as intended.** Every vulnerability test fails on the old code; the 5 that pass check behaviour that was already correct (admins keep access, logout) or the new helper functions themselves. |
| Spring Boot `mvn clean verify` | **108 tests, 0 failures, 0 skipped** (97 before + 11 new); includes the 105-step parity scenario |
| Mutation check | Removing the city check or trusting the raw cookie again in Spring makes `StaffScenarioParityTest` and `SecurityHardeningIntegrationTest` fail. Code restored afterwards. |

Every fix is tested with both authorised and unauthorised callers. Covered: anonymous; customer; partner;
relationship manager; field executive; zonal head inside and outside their territory; zonal head without a city;
admin; super admin; a still-valid cookie of a demoted user; a super-admin claim for a deleted account; forged, edited,
expired, foreign-key and wrong-type tokens; session/executive token swaps.

**Not run:** the Next.js production build (`next build`) and lint. The changed files were compiled and executed by
the tests, but please run the normal build before deploying (the project ignores TypeScript build errors, so a type
mistake would not stop the build — run `npx tsc --noEmit` if you want that check).

## 7. Security issues that remain

Updated after Part 2. Most serious first. Details in `backend/README.md` → "Preserved behaviour that needs a decision".

1. ~~Partners, field executives, zonal heads and RMs count as "admin"~~ — **fixed in Part 2** (section 8).
2. **Order permissions are still broad** (order domain, to be fixed with the order migration): field executives can
   change any order, not only their own (`updateOrderStatus`, `submitVerification`; no longer reachable
   anonymously); and `assignRider`, `restoreOrder`, `deleteOrder`, `updateOrderHubStatus` and `/api/admin/orders/*`
   let partners, RMs and zonal heads act on any order without checking it is in their pincodes.
3. **Prices are trusted from the browser** when an order is placed or re-evaluated (order migration, decision D2).
4. **Other debug routes** — `/api/debug/cleanup-garbage` and `/api/fix-data` change catalog data on a plain GET,
   key-protected in production but **open outside production** (decision D9).
5. **Notifications trust the role/user id sent by the browser** (`actions/notifications.ts`).
6. **Sign-in email lookup treats `%` and `_` as wildcards**; `quickRegister` skips email verification.
7. **Roles in the session cookie are trusted for 7 days** for page views (admin layout, riders page, RM dashboard)
   and order actions; every operation fixed in Parts 1 and 2 reads the database role instead.
8. **Session cookies lack `Secure`, and a known fallback secret is used if `AUTH_SECRET` is missing** (SEC-10).
9. **Rider onboarding has no phone verification:** whoever first knows the phone number of a rider without a
   password can set it.
10. **Infrastructure items from the execution plan are untouched by this code change:** exposed database/admin
    ports, credential rotation, backups (SEC-00 to SEC-07).
11. ~~Every sign-in writes the full user record (password hash, reset code) to the server log~~ — **fixed** (section 9).
    Spring Boot never had that line, but logged PostgreSQL error details that can contain a user's full row — also fixed.
12. **Decisions still open on permissions** (section 8.5).

---

## 8. Part 2 — Staff permissions (2026-10-05)

### 8.1 The problem

`isAdmin()` (website) and `AccessRules.requireAdmin` (Spring Boot) answer "may this user open the staff panel?" —
true for SUPER_ADMIN, ADMIN, ZONAL_HEAD, RELATIONSHIP_MANAGER, PARTNER **and FIELD_EXECUTIVE**. 27 of the 36
actions in `actions/admin.ts` used it as their only authorization check (the Spring ports did the same), so any
partner or field executive could grant ADMIN to anyone, demote any admin, change pricing rules and the catalog, edit the landing
page, create zonal-head accounts, and add or remove riders for any partner. Several admin pages and their built-in
forms had no role check of their own beyond the panel gate.

### 8.2 Final permission behaviour

Derived from the existing application, not invented: the admin sidebar (which links each role sees), each page's own
checks, and which controls each page offers to each role. Roles are read from the database on every call.

| Operation | SUPER_ADMIN, ADMIN | ZONAL_HEAD | RELATIONSHIP_MANAGER | PARTNER | FIELD_EXECUTIVE |
|---|---|---|---|---|---|
| Grant/revoke ADMIN, ZONAL_HEAD, RM; list admins; change a partner's manager | ✓ | ✗ | ✗ | ✗ | ✗ |
| Grant PARTNER (`addPartner`) | ✓ | ordinary accounts¹, into a city they manage | ordinary accounts¹ | ✗ | ✗ |
| Grant FIELD_EXECUTIVE (`addFieldExecutive`) | ✓ | ordinary accounts¹ | ✗ | ordinary accounts¹ | ✗ |
| List partners by manager | ✓ | own id only | ✗ | ✗ | ✗ |
| Pricing rules, catalog, landing page | ✓ | ✗ | ✗ | ✗ | ✗ |
| Users directory, zonal-heads page and its forms | ✓ | ✗ | ✗ | ✗ | ✗ |
| Partners page and its forms | ✓ | ✓ (own cities) | ✓ | ✗ | ✗ |
| Cities page (Part 1 rules) | ✓ | ✓ (own cities) | ✗ | ✗ | ✗ |
| Add / remove riders | ✓ | own team² | ✗ | own team² | ✗ |
| Move a rider to another partner | ✓ | own team² | ✗ | ✗ | ✗ |

¹ USER or UNVERIFIED accounts, or accounts that already have that role — never another staff member's role.
² A zonal head's team: partners in a city they manage or with them as manager; a partner's team: themselves.
Removing a rider never resets the role of an account that is not an ordinary or field-executive account.

### 8.3 What was fixed

- Role grants and revocations, admin list, partner-manager changes: administrators only (previously any staff role).
- Pricing rules, catalog changes and landing-page settings: administrators only.
- PARTNER / FIELD_EXECUTIVE grants by non-administrators: only for ordinary accounts (a partner could previously turn
  an admin into a field executive), and a zonal head only into their own cities.
- Rider add/remove/move: limited to the caller's team (a partner could previously add riders to, or remove riders
  of, any partner; removing a rider with an admin's id demoted the admin).
- `getPartnersManagedBy`: no longer open to anonymous callers.
- Admin-only pages (users, zonal heads, landing page, catalog) and the partners and cities pages now refuse roles
  the sidebar does not offer them to; their built-in forms check the caller themselves (they could be called
  directly).
- `isAdmin` / `requireStaffPanel` are kept only as the staff-panel gate and documented as such.

### 8.4 Files changed (Part 2)

| Website | Change |
|---|---|
| `lib/staff-access.ts` | the permission model (role lists, ordinary-account targets, teams) |
| `actions/admin.ts` | explicit checks on every staff action |
| `app/admin/admins/page.tsx`, `zonal-heads/page.tsx`, `homepage/page.tsx`, `category/[slug]/page.tsx`, `partners/page.tsx`, `cities/page.tsx` | page gates and checks in built-in forms |
| `lib/auth-utils.ts` | comment only: `isAdmin` is the panel gate |
| `scripts/security-tests/` | `permissions.test.ts`, `all.test.ts`, `auth-ref.ts`, `pricing-ref.ts` (new); `staff-ref.ts`, `run.sh`, README (updated) |

| Spring Boot (`backend/`) | Change |
|---|---|
| `auth/rules/StaffAccess.java` (new) | the same permission model |
| `user/service/StaffRoleService`, `PartnerAdminService`, `ZonalHeadAdminService`, `StaffDirectoryService`; `rider/service/RiderAdminService`; `city/service/CityAdminService`, `CityAccess`; `pricing/service/PricingService`; `user/api/StaffController` | explicit checks |
| `auth/rules/AccessRules`, `Roles`, `RelationshipManagerDashboardService` | `requireAdmin` renamed `requireStaffPanel` (panel gate only) |
| Tests: `StaffPermissionsIntegrationTest` (new); `AccessRulesTest`, the three parity tests (updated); golden scenarios: staff 105 → 156 steps, pricing 27 → 35, auth regenerated | |

### 8.5 Ambiguous permissions — need a business decision

Kept as the current pages behave; not changed:

1. **An ADMIN can create other ADMINs, and remove a SUPER_ADMIN** whose status comes only from the database role
   (the Users page offers both to admins). Should these be SUPER_ADMIN-only?
2. **Relationship managers have admin-level partner management** on the Partners page (any city, any manager, grant
   PARTNER). Is that intended, or should RMs only view partners?
3. **The sidebar shows "Field Executives" to RMs, but the page refuses them.** Should RMs manage riders?
4. **Zonal heads may move a rider of their team to "no partner"** (offered by the page), after which they no longer
   see that rider.
5. **`getPartnersManagedBy` is not used by any page**; it now allows administrators, and zonal heads for their own
   id. Could be removed.
6. **Who may manage orders** (assign, fail, restore, delete, hub handover) — part of the order migration.

### 8.6 Test results (Part 2)

| Suite | Result |
|---|---|
| Website tests (`run.sh test`: Part 1 + 14 new permission tests) | **36 / 36 passed** on every run of the unmodified code. A test-setup race between the two test files (both switched the current cookie jar in top-level hooks) showed up once during mutation testing and was fixed. |
| Same tests against the pre-hardening code (`run.sh originals`) | **30 / 36 failed, as intended**; all new permission tests fail except "administrators can still grant and revoke", which was already true |
| Golden files regenerated from the fixed website | staff: first 105 steps **unchanged** (existing workflows unaffected), 51 new steps; pricing: rules and quotes unchanged; auth: only the partner's ADMIN grant, admin listings and the anonymous partner list changed |
| Spring Boot `mvn clean verify` | **115 tests, 0 failures, 0 skipped** (108 before + 7 new) |
| Mutation tests | Spring "role grants by any staff role" → caught by `StaffPermissionsIntegrationTest`, `AuthScenarioParityTest`, `StaffScenarioParityTest`; Spring "pricing by any staff role" → caught by `StaffPermissionsIntegrationTest`, `PricingScenarioParityTest`, `StaffScenarioParityTest`; website `requireAdmin` back to "any staff" → 6 permission tests fail. Code restored after each run. |

**Compatibility:** no schema change, no data change, nobody is logged out. Staff who were using actions outside their
role (e.g. a partner editing pricing) now get an error; everything the sidebar offers each role still works.

---

## 9. Sensitive data in logs (2026-10-05)

- **Website:** `actions/auth.ts` logged the whole user record on every successful sign-in
  (`console.log('DEBUG SIGNIN USER:', user)`) — password hash, reset/verification code and its expiry. Now it logs
  only `[Auth] Sign-in succeeded { userId, role }`. No other log statement prints passwords, hashes, codes, tokens or
  secrets (all server-side log calls reviewed).
- **Spring Boot:** no such line, but database errors were logged with PostgreSQL's error detail, which for a failed
  insert or update of a user lists the whole row ("Failing row contains (…, $2b$10$…, …)") — e.g. "User registration
  failed". The JDBC driver now runs with `logServerErrorDetail=false` (application.yml); the main error line, the
  SQL state and the duplicate-email/phone handling are unchanged.
- **Tests:** `scripts/security-tests/logging.test.ts` captures every console call during sign-in (customer, super
  admin, wrong password, phone), sign-up, unverified sign-in, verification, password reset, quick register/login and
  executive login, and fails if any password, hash, code, cookie value or the secret appears.
  `SensitiveLoggingIntegrationTest` does the same for Spring and forces a registration failure whose PostgreSQL
  detail would contain the row. Mutation checks: putting the old sign-in log back fails the website test ("logged a
  secret: $2b$10$…"); removing the driver setting fails the Spring test (the log contained the user's hash).
- The website test runner now points SMTP at a closed local port: the website falls back to the production mail
  server when `SMTP_HOST` is unset, and tests must never send real email.
- Results: website **37 / 37**, Spring `mvn clean verify` **117 tests, 0 failures**. No behaviour, schema or data change.
