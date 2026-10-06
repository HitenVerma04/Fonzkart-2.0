# Fonzkart Backend (Spring Boot)

Incremental replacement of the Next.js/Prisma backend. **Current scope:**

1. **Catalog** — read-only (brands, models, variants, search, device-name lookup).
2. **Authentication & user management** — sign-up, email OTP verification, sign-in (email or phone), password reset, quick register/login, logout, sessions, profile, staff role management, and the user operations of the admin pages (role directory, partners, zonal heads).
3. **Field executives, cities & RM dashboard** — rider (field-executive) administration, granting FIELD_EXECUTIVE, executive phone login, city management (cities page, pincode actions, featured/order, homepage lists, pincode availability), zonal-head city assignment, and the relationship-manager dashboard.
4. **Pricing & evaluation engine** — the quote calculation (`calculatePrice`) and evaluation-rule management (`getEvaluationRules`, `upsertEvaluationRule`).

The Next.js app is unchanged and still serves all traffic; this service runs alongside it against the same PostgreSQL database. **It must not receive traffic for these domains until the corresponding Next.js paths are switched over together** (single-writer rule for `"User"`, `"Rider"`, `"City"` and `"EvaluationRule"`). `"Order"` is only read (by the riders page and RM dashboard); the order domain itself is not migrated.

- Java 17+, Spring Boot 3.5, Maven
- Spring Data JPA (Hibernate 6) mapped onto the **existing Prisma tables** — no schema changes, ever
- Business logic ported 1:1 from the TypeScript sources named in each class

## Run locally

Prerequisites: JDK 17+, Maven 3.9+, a reachable PostgreSQL database with the Fonzkart schema.

| Variable | Required | Example | Notes |
|---|---|---|---|
| `DB_URL` | yes | `jdbc:postgresql://localhost:5432/postgres` | JDBC form of Prisma's `DATABASE_URL` (`postgresql://user:pass@host:port/db` → `jdbc:postgresql://host:port/db`) |
| `DB_USERNAME` | yes | `postgres` | |
| `DB_PASSWORD` | yes | — | |
| `AUTH_SECRET` | yes* | — | **Same value as the Next.js app** — session cookies are then interchangeable. *If unset, the same development fallback key as `lib/session.ts` is used (with a warning), exactly like the original. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` / `SMTP_PASS`, `SMTP_FROM` | for email | — | Same variables as the Next.js app. Credentials fall back to the first `"EmailAccount"` row, as in the original. |
| `SMTP_FALLBACK_HOST` | no | — | Used when `SMTP_HOST` is unset (the original hard-codes a server IP here instead). |
| `NEXT_PUBLIC_APP_URL` | no | `https://www.fonzkart.in` | Link in the welcome email |
| `DB_POOL_SIZE` | no | `5` | Hikari max pool size (default 5) |
| `PORT` | no | `8080` | HTTP port (default 8080) |

PowerShell:

```powershell
$env:DB_URL="jdbc:postgresql://localhost:5432/postgres"; $env:DB_USERNAME="postgres"; $env:DB_PASSWORD="<password>"; $env:AUTH_SECRET="<same as Next.js>"
mvn spring-boot:run
```

Bash:

```bash
DB_URL=jdbc:postgresql://localhost:5432/postgres DB_USERNAME=postgres DB_PASSWORD='<password>' AUTH_SECRET='<same as Next.js>' mvn spring-boot:run
```

Or build and run the jar:

```bash
mvn verify
java -jar target/fonzkart-backend-0.1.0-SNAPSHOT.jar
```

Health check: `GET http://localhost:8080/actuator/health`

## Deploy (Docker / Coolify)

`backend/Dockerfile` builds a runnable image (Maven build stage, JRE 17 runtime, non-root user, port 8080). In
Coolify: build pack "Dockerfile", Base Directory `/backend`, port 8080, health check path
`/actuator/health/liveness`. Set `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `AUTH_SECRET` (the website's value) and the
`SMTP_*` variables as Coolify environment variables. Tests are not run inside the image build; run `mvn verify` before
deploying. Verified 2026-10-06: image builds, starts in ~9 s against the schema, `/actuator/health/liveness` is UP and
the catalog API answers.

## Safety guarantees

- **No schema changes:** `spring.jpa.hibernate.ddl-auto=validate` (startup fails if entities don't match the existing tables; nothing is created/altered/dropped). No Flyway/Liquibase yet.
- **Catalog and orders cannot write:** every catalog repository and the order projection (`OrderReadRepository`, no save/delete methods) run in `@Transactional(readOnly = true)`, and pgjdbc `readOnlyMode=always` makes PostgreSQL itself reject writes in those transactions. Their entities are `@Immutable` ("EmailAccount" too).
- **JavaScript-identical JSON:** numbers are serialised like `JSON.stringify` (`77`, not `77.0`), dates like `toISOString()`, and JSON stored in text columns (`answers`, `riderAnswers`) is re-emitted as JavaScript would after `JSON.parse`.
- **No plain-text rider passwords in responses:** `"Rider"."password"` is stored and compared as the original does but never returned (the original sends it to the browser with rider lists).
- **User / rider / city writes mirror Prisma:** each write is a single statement like the original Prisma call (no multi-step transactions), sets `updatedAt` (Prisma's client-side `@updatedAt`), keeps `createdAt`/`updatedAt` in UTC with millisecond precision, generates `cuid()`-format ids where Prisma would, and inserts `pincodes` as `'{}'`.
- **UTC:** the JVM and JDBC session run in UTC (Prisma stores `DateTime` as UTC in `timestamp without time zone`). Applied by `shared/time/UtcTimeZone` (registered in `META-INF/spring.factories`) for every startup path, which also avoids host zone aliases such as `Asia/Calcutta` that PostgreSQL rejects.
- **Identifiers:** quoted exactly as Prisma created them (`"Brand"`, `"brandId"`, `"passwordHash"`, …).
- **No password material in responses:** user objects never include `passwordHash`, `resetToken` or `resetTokenExpiry` (several original server actions send these to the browser; that is not reproduced).

## Response contract for migrated server actions

Auth and user endpoints mirror server-action semantics so the frontend can be connected through thin proxies:

| HTTP | Meaning |
|---|---|
| **200** | The action completed. The body is **exactly what the original returned** — including form errors such as `{"error": "Invalid email/phone or password"}` and results such as `{"success": false, "error": "..."}`. Where the original called `redirect(url)`, the body is `{"redirectTo": url}`. |
| **401 / 403** | The original **threw** `Unauthorized` / `Forbidden: Admin access required` (or the admin layout redirected away). Body `{"error": message}`. |
| **404 / 409 / 500** | The original threw for another reason (missing record — Prisma P2025, constraint violation, …). Body `{"error": message}`. |

Sessions use the original cookie: `session=<JWT>; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax` (logout sends `Max-Age=0`). Endpoints read the session from the `session` cookie forwarded by Next.js.

**Phone apps (Customer, Partner, Admin)** use the same tokens in headers (`shared/web/MobileClients`):
- On the sign-in, sign-up, verify, quick-register/login and executive login/onboard endpoints, an app sends `X-Client: mobile`. It gets the token in the `X-Auth-Token` response header instead of `Set-Cookie`, with the same body (including `redirectTo`, which the app maps to a screen).
- On every later request, the app sends `Authorization: Bearer <token>`. That header **takes precedence over the cookie**: when it is sent, the cookie is ignored, even if the token is invalid. Other schemes (e.g. `Basic` from a proxy) leave the cookie in charge.
- User session tokens and executive tokens are signed with different keys and are never accepted as each other.
- Sign-out on a phone means deleting the stored token. Like the cookie, a token stays valid until it expires (7 days).

Covered by `BearerSessionTest`, `ActionResponseTest` and `MobileClientsTest`. Website requests are unaffected.

## Catalog API

All endpoints are public, as the original server functions are. Responses have the same JSON shape as the Prisma objects returned today.

| Endpoint | Replaces |
|---|---|
| `GET /api/catalog/brands?category=` | `actions/catalog.ts → fetchBrands(category?)`, `actions/admin.ts → getBrands()`, `db.getBrands()` |
| `GET /api/catalog/brands/{id}` | `db.getBrand(id)` — **404** where the original returns `null` |
| `GET /api/catalog/models?brandId=&category=` | `fetchModels(brandId, category?)`, `actions/admin.ts → getModels(brandId?)`, `db.getModels()` |
| `GET /api/catalog/models/search?query=` | `searchGlobalModels(query)` (queries < 2 chars → `[]`) |
| `GET /api/catalog/variants?modelId=` | `fetchVariants(modelId)`, `actions/admin.ts → getVariants(modelId?)`, `db.getVariants()` |
| `GET /api/catalog/variants/lookup?deviceName=` | `findVariantByName(deviceName)` — **404** where the original returns `null` |

Ported behaviour includes: category aliases (`mobile`/`smartphone`, `watch`/`smartwatch`, `tablet`/`ipad`, `tv`/`smarttv`), `DEFAULT_CORE_BRANDS` fallback, merge with the 2026 static catalog, canonical-name de-duplication, image resolution, `priority` + `localeCompare` ordering (ICU4J, same as Node), DB-error fallbacks, and 2026-catalog fallbacks for variants and device-name lookup.

**Intentional difference:** `db.getModels()` in Next.js starts a fire-and-forget background task that **inserts** missing 2026 catalog brands/models/variants into the database during a read. This service does **not** do that (read-only, single-writer rule). Responses are unaffected because 2026 catalog models are merged into every response anyway.

## Auth API

| Endpoint | Body | Replaces |
|---|---|---|
| `POST /api/auth/signin` | `{email, password}` | `actions/auth.ts → signin` (email or phone; UNVERIFIED → new OTP + redirect to `/verify-email`; super-admin / forced-user role sync; redirect `/admin` or `/`) |
| `POST /api/auth/signup` | `{name, email, phone, password}` | `signup` (+91 prefix, duplicate checks, UNVERIFIED + OTP email, or SUPER_ADMIN login for configured emails) |
| `POST /api/auth/verify-email` | `{email, otp}` | `verifyEmailSignup` (role → USER/SUPER_ADMIN, welcome email, login) |
| `POST /api/auth/password-reset/request` | `{email}` | `requestPasswordReset` |
| `POST /api/auth/password-reset/confirm` | `{email, otp, password}` | `verifyAndResetPassword` |
| `POST /api/auth/quick-register` | `{name, email, phone?, password}` | `actions/inlineAuth.ts → quickRegister` (no email verification, as in the original) |
| `POST /api/auth/quick-login` | `{email, password}` | `quickLogin` |
| `POST /api/auth/logout` | — | `lib/session.ts → logout` |
| `GET /api/auth/session` | — | `getSession()` → `{"session": payload \| null}` |

Compatibility details (all verified by tests against the original libraries):
- **Passwords:** bcrypt `$2b$`, cost 10, UTF-8 with only the first 72 bytes significant — identical to `bcryptjs` 3.x; existing `$2a$`/`$2b$` hashes verify unchanged.
- **Session JWT:** HS256 with `AUTH_SECRET`, header `{"alg":"HS256"}`, payload `{"user":{id,email,name,role},"expires":ISO,"iat","exp":iat+1 week}` — byte-for-byte identical to `jose` 6; verification accepts/rejects exactly what `jwtVerify` does. Implemented on HMAC-SHA256 directly because Java JWT libraries reject keys shorter than 256 bits, which `jose` accepts.
- **OTP:** 6 digits, 15 minutes, stored in `resetToken`/`resetTokenExpiry` (SecureRandom instead of `Math.random()`).

## User & staff API

Access uses the database role (`auth/rules/StaffAccess`); "admins" = SUPER_ADMIN, ADMIN.

| Endpoint | Replaces | Access |
|---|---|---|
| `GET /api/users/me` | `app/profile/page.tsx` data | session (401 = page redirects to /login) |
| `PUT /api/users/me` `{name, phone?}` | `actions/profile.ts → updateProfile` | session (returns `{error:'Unauthorized'}`) |
| `GET /api/staff/admins` | `actions/admin.ts → getAdmins` | admins |
| `POST /api/staff/admins` `{email}` | `addAdmin` | admins |
| `POST /api/staff/admins/remove` `{email}` | `removeAdmin` | admins |
| `POST /api/staff/zonal-heads/grant` `{email}` | `addZonalHead` | admins |
| `POST /api/staff/relationship-managers/grant` `{email}` | `addRelationshipManager` | admins |
| `POST /api/staff/partners/grant` `{email, cityId?, managerId?}` | `addPartner` | admins; ZONAL_HEAD and RELATIONSHIP_MANAGER for an ordinary account (USER / UNVERIFIED / already PARTNER); a zonal head only into a city they manage and with no manager or themselves; a partner granted by an RM becomes that RM's partner (`relationshipManagerId`) |
| `POST /api/staff/roles/remove` `{email}` | `removeUserRole` | admins |
| `PUT /api/staff/partners/{id}/manager` `{managerId}` | `updatePartnerManager` | admins |
| `GET /api/staff/partners/managed-by/{managerId}` | `getPartnersManagedBy` | admins; a ZONAL_HEAD for their own id |
| `GET /api/staff/directory` | `app/admin/admins/page.tsx` data (incl. its forced-user demotion side effect) | admins |
| `GET /api/staff/partners/overview` | `app/admin/partners/page.tsx` data (zonal-head scoped; each partner with its `relationshipManager`, plus the list of `relationshipManagers`) | admins, ZONAL_HEAD, RELATIONSHIP_MANAGER |
| `POST /api/staff/partners` `{..., relationshipManagerId?}` | partners page inline "create partner" (zonal-head rules; an RM's new partner is theirs, others may pick an RM) | admins, ZONAL_HEAD, RELATIONSHIP_MANAGER |
| `PUT /api/staff/partners/{id}/assignment` `{cityId, managerId, relationshipManagerId?}` | partners page inline "update assignment" (zonal-head rules; RMs cannot change a partner's RM; "none" clears it; only RELATIONSHIP_MANAGER users are accepted) | admins, ZONAL_HEAD, RELATIONSHIP_MANAGER; partner must be visible to the caller |
| `GET /api/staff/zonal-heads` | `app/admin/zonal-heads/page.tsx` data | admins |
| `POST /api/staff/zonal-heads` | zonal-heads page inline "Register Zonal Head" | admins |

## Field executives, cities & RM dashboard API

| Endpoint | Replaces | Access |
|---|---|---|
| `GET /api/riders/overview` | `app/admin/riders/page.tsx` data (scoped by the viewer's DB role: admins all, zonal heads their partners' riders, partners their own) | session role SUPER_ADMIN/ADMIN/ZONAL_HEAD/PARTNER (the page's own check, unchanged) |
| `POST /api/riders` `{name, phone, email?, partnerId?}` | `addRider` | admins (any partner); ZONAL_HEAD (one of their partners, or none); PARTNER (themselves) |
| `DELETE /api/riders/{id}` | `deleteRider` (id of a Rider and/or a User: user reset to USER, rider deleted, its orders kept with `riderId = NULL`) | admins; ZONAL_HEAD and PARTNER for a rider of their team, never resetting a staff account other than a field executive |
| `PUT /api/riders/{id}/partner` `{partnerId}` | `updateRiderPartner` | admins; ZONAL_HEAD for a rider of their team, to one of their partners or none |
| `POST /api/riders/field-executives` `{email}` | `addFieldExecutive` (role + Rider sync by phone; a granting PARTNER becomes the rider's partner) | admins; ZONAL_HEAD and PARTNER for an ordinary account (USER / UNVERIFIED / already FIELD_EXECUTIVE) |
| `POST /api/executive/login` `{phone, password?}` | `actions/executive.ts → loginExecutive` (onboarding / password required / invalid; bcrypt check, a legacy plain-text password is accepted once and re-hashed; sets the signed `executive_id` cookie) | public (the phone + password are the credentials) |
| `POST /api/executive/onboard` `{id, password}` | `onboardExecutive` — sets a **first** password only (rider without a password), stored as a bcrypt hash | public, but refused once the rider has a password |
| `POST /api/executive/logout` | `logoutExecutive` | none |
| `GET /api/executive/session` | `getExecutiveSession()` → `{"executive": rider | null}` (valid signed `executive_id` token, else FIELD_EXECUTIVE session by phone, else by id; forged, tampered, expired or raw-id cookies are ignored) | signed cookie or session || null}` (cookie, else FIELD_EXECUTIVE session by phone, else by id) | none |
| `GET /api/cities/overview` | `app/admin/cities/page.tsx` data, **including its seeding of default cities** for non-zonal-head viewers | admins, ZONAL_HEAD |
| `POST /api/cities/hubs` `{cityName}` | cities page "Register Hub" (upsert by name) | SUPER_ADMIN, ADMIN, ZONAL_HEAD (database role) |
| `PUT /api/cities/{id}/pincodes` `{pincodes}` | `app/admin/cities/actions.ts → updateCityPincodes` | SUPER_ADMIN, ADMIN; ZONAL_HEAD for their own cities |
| `PUT /api/cities/{id}/active` `{isActive}` | `toggleCityActive` | SUPER_ADMIN, ADMIN |
| `PUT /api/cities/partners/{partnerId}/pincodes` `{pincodes}` | `updatePartnerPincodes` | SUPER_ADMIN, ADMIN; ZONAL_HEAD for partners in their cities or managed by them |
| `POST /api/cities/partners/{partnerId}/remove` | `removePartnerFromCity` | as above |
| `PUT /api/cities/{id}/featured` `{isFeatured}` | `actions/admin.ts → toggleFeaturedCity` | admins |
| `PUT /api/cities/{id}/display-order` `{order}` | `updateCityDisplayOrder` (`parseInt` semantics) | admins |
| `GET /api/cities/homepage` | `app/admin/homepage/page.tsx` city list | admins |
| `GET /api/cities/active-names` | `app/page.tsx` active city names | public |
| `GET /api/cities/active` | zonal-heads page city choices | admins |
| `GET /api/cities/pincode-availability?pincode=` | `actions/orders.ts → checkPincodeAvailability` → `true`/`false` | public |
| `POST /api/staff/zonal-heads/{id}/cities` `{cityId}` | zonal-heads page "Assign" | admins |
| `DELETE /api/staff/zonal-heads/{id}/cities/{cityId}` | zonal-heads page "x" on an assigned city (404 if not assigned to that zonal head) | admins |
| `GET /api/staff/rm-dashboard` | `app/admin/rm-dashboard/page.tsx` (the viewing RM's own partners — `"User"."relationshipManagerId"` — with riders, manager, city, their orders: routed to them by `"Order"."partnerId"`, or for unrouted legacy orders by pincode/rider, unassigned/assigned/delayed > 5 min, `totalDelayed`) | admin layout + role **RELATIONSHIP_MANAGER only** |
| `GET /api/staff/directory` | now also returns native `riders` (the admins page lists `[...riders, ...fieldExecutiveUsers]`) | admins |

Authorization lives in `auth/rules/StaffAccess` (role lists, ordinary-account targets, a zonal head's or partner's team) and `city/service/CityAccess` (Cities page territory); both read the caller's role from the database on every call instead of trusting the role in the session cookie. `AccessRules.isAdmin` / `requireStaffPanel` only decide whether someone may open the staff panel (every staff role) and are no longer used to authorize operations.

## Pricing & evaluation API

| Endpoint | Replaces | Access |
|---|---|---|
| `POST /api/pricing/calculate` `{basePrice, answers, category?}` → price | `actions/priceCalculation.ts → calculatePrice(basePrice, answers, category = 'smartphone')` — called by `components/sell/FinalQuote.tsx` (customer quote) and `components/admin/VerificationModal.tsx` (executive re-evaluation) | none |
| `GET /api/pricing/rules?category=` | `actions/admin.ts → getEvaluationRules(category)` and the rules loaded by `app/admin/category/[slug]/page.tsx` (no category → all rules) | none |
| `PUT /api/pricing/rules` `{category, questionKey, answerKey, label, deductionAmount, deductionPercent}` → `{success: true}` | `actions/admin.ts → upsertEvaluationRule` (used by `components/admin/PricingRulesManager.tsx`) | admins |

How a price is computed (unchanged, `pricing/rules/PriceCalculator`):

1. `price = basePrice`. Rules are those in `"EvaluationRule"` whose `category` equals the given category **exactly**, applied in database order (no `ORDER BY`, like the original).
2. **With rules:** for each rule, the answer to `questionKey` is checked — boolean answers match `answerKey` `'true'`/`'false'`; array answers match when they include `answerKey`, or when they do *not* include `x` for `answerKey = '!x'`; string answers match when equal. A match subtracts `deductionAmount` and `deductionPercent`% **of the base price** (negative values are bonuses; percentages never compound).
3. **Without rules** (the whole category has none): the original hard-coded logic for `smartphone`, `laptop`, `tablet`, `watch`, `camera`, `tv`/`smarttv`; any other category gets no deductions.
4. **Floor:** 400; for base prices ≥ 50,000: 1,800 (flawless/good), 1,200 (average), 500 (anything else, including a missing or non-string condition). Result: `Math.floor(Math.max(price, floor))`.

The client's `answers` are evaluated with JavaScript semantics (`pricing/rules/JsValues`), so unusual inputs behave exactly as before — e.g. a string `accessories` value is substring-matched, a string `functional_issues` counts its characters, a number where a list is expected makes the original throw (here: HTTP 500), and missing `answers` only fail when they are read. Responses are a JSON number (`null` where JavaScript produced `NaN`). `basePrice` must be a JSON number (400 otherwise; every caller sends a number).

`upsertEvaluationRule` follows Prisma 5.21's behaviour exactly (verified): `label` is required on every call (Prisma validates the create branch even when the rule exists); `deductionAmount`/`deductionPercent` default to 0 on create and are left unchanged on update when omitted; a non-integer `deductionAmount` is truncated toward zero (2.7 → 2); out-of-range, null or non-numeric values fail.

Static configuration involved, kept in the frontend because it is UI configuration compiled into the client: `lib/data.ts → questionnaireSteps` (questions and answer keys per category — the keys rules refer to) and `components/admin/PricingRulesManager.tsx → PREFILL_DEFAULTS` (suggested values in the rules editor).

### Security hardening (fixed in the website and in Spring Boot)

Fixed in both backends with identical behaviour (proved by `StaffScenarioParityTest`), with regression tests on both sides (`scripts/security-tests` for the website, see `SECURITY_HARDENING_REPORT.md` in the repository root):

- **City and partner pincodes** (finding 8): updating a city's pincodes, switching a city on/off, changing or removing a partner's pincodes and "Register Hub" now require a signed-in user whose **database** role allows it — SUPER_ADMIN/ADMIN everywhere; ZONAL_HEAD only for their own city, the cities they manage and the partners in them (not the on/off switch, which the page hides from them). Errors: 401 `Unauthorized`, 403 `Forbidden: Admin access required`, 403 `Forbidden: Outside your assigned cities`.
- **Rider passwords** (finding 9): stored as bcrypt hashes (`$2b$10$`, like user passwords). Existing plain-text values still work and are re-hashed on the next successful login; `scripts/hash-rider-passwords.ts` converts the rest. No schema change.
- **Executive cookie** (finding 9): `executive_id` holds a signed HS256 token `{typ: 'executive', sub: riderId}` valid for 7 days, with a key derived from `AUTH_SECRET` (`auth/session/ExecutiveTokenCodec`, `ExecutiveSessions`). Raw rider ids, tampered/expired tokens and user session tokens are ignored.
- **Onboarding** (finding 9): `onboard` only sets a first password; it is refused for a rider who already has one and for an empty password.
- **Website only** (not in Spring Boot): `/api/diagnose-user` now requires a SUPER_ADMIN session and never returns the password hash or reset code; admin pages no longer send password hashes, reset codes or rider passwords to the browser.
- **Staff permissions** (findings 2, 3, 10, 13 — second hardening phase): being signed in or allowed into the staff panel no longer makes anyone an administrator. Granting/revoking ADMIN, ZONAL_HEAD and RELATIONSHIP_MANAGER, the user directory, zonal-head management, pricing rules, catalog changes (website) and landing-page settings are for SUPER_ADMIN/ADMIN only. Zonal heads and RMs may grant PARTNER and zonal heads and partners may grant FIELD_EXECUTIVE — only to ordinary accounts (USER, UNVERIFIED or the same role), never changing another staff member's role. Zonal heads and partners manage only the riders of their own team; moving riders between partners is for admins and zonal heads. `getPartnersManagedBy` needs an admin, or a zonal head asking about themselves. Pages offered by the sidebar to certain roles only (users, zonal heads, landing page, catalog for admins; partners also for zonal heads and RMs; cities also for zonal heads) now refuse everyone else, including their built-in forms. New error messages: 403 `Forbidden: Outside your team`, 403 `Forbidden: Cannot change this user's role`.

### Preserved behaviour that needs a decision (security findings)

These are faithful to the original on purpose and are covered by the parity tests; changing them requires approval (2, 3, 8, 9, 10 and 13 are fixed, see above):

1. **Email lookup wildcards** — `db.findUserByEmail` uses Prisma `equals … mode: 'insensitive'`, which Prisma 5.21 compiles to `"email" ILIKE $1` **without escaping**. `%` and `_` act as wildcards: signing in with `_lice@example.test` logs in as `alice@example.test` if the password matches; `%` matches the first user. (`UserRepository.findFirstByEmailInsensitive`.)
2. ~~`isAdmin()` lets PARTNER, FIELD_EXECUTIVE, ZONAL_HEAD and RELATIONSHIP_MANAGER perform admin operations (e.g. grant ADMIN)~~ — **fixed** (staff permissions). `isAdmin()` now only opens the staff panel.
3. ~~`getPartnersManagedBy` has no access check~~ — **fixed** (staff permissions).
4. **`quickRegister` skips email verification; `quickLogin` lets UNVERIFIED accounts sign in.**
5. **Roles in the session cookie are trusted for up to 7 days** (changes take effect at next login) — no longer for the operations covered by `StaffAccess`/`CityAccess`, which read the database role; still for page views such as the riders page, the RM dashboard and the admin layout.
6. **Session cookie has no `Secure` flag; development fallback secret** when `AUTH_SECRET` is unset.
7. **Hard-coded identity rules** (super-admin and forced-user emails) — now configuration (`fonzkart.auth.*`) with the original values as defaults.
8. ~~City and partner-territory actions have no access check~~ — **fixed** (security hardening).
9. ~~Executive login is weak (plain-text passwords, unsigned `executive_id`, onboarding of any rider)~~ — **fixed** (security hardening). Still true by design: an empty or missing rider password means "needs onboarding", so whoever first knows the phone number of a rider who has not set a password can set it (there is no SMS/OTP step).
10. ~~Rider administration inherits the broad `isAdmin()`; `addRider` does not restrict `partnerId`~~ — **fixed** (staff permissions: team limits).
11. **Writes during reads**: viewing the cities page seeds the default cities (Madurai, Chennai, Coimbatore, Bangalore) for non-zonal-head admins; viewing the admins page demotes forced-user accounts.
12. **RM dashboard quirks**: "unassigned" excludes statuses `'Completed'`/`'Cancelled'` (capitalised) although stored statuses are lower-case, so completed orders without a rider count as unassigned/delayed; only RELATIONSHIP_MANAGER may view it (not admins).
13. ~~Pricing rules can be changed by any staff role~~ — **fixed** (staff permissions: SUPER_ADMIN and ADMIN only).
14. **Quotes are computed for the client and trusted later**: the customer's final price is sent back by the browser in `placeOrder` and the executive's revised price in `submitVerification`; nothing recomputes it server-side (order migration, decision D2).
15. **Category mismatch**: the sell flow requests prices for `smartwatch`/`smarttv` while the rules editor and the hard-coded logic use `watch`/`tv` — smartwatch quotes get no deductions at all (only the floor), and smart-TV quotes ignore any `tv` rules. Preserved as-is.
16. **Executive order actions do not check ownership** (website, order domain): `updateOrderStatus` and `submitVerification` in `actions/executive.ts` accept any order id from any signed-in field executive — not only orders assigned to them. Since the hardening an anonymous caller can no longer reach them with a forged cookie. To be fixed with the order migration.
17. **Other debug/maintenance routes** (website): `/api/debug/cleanup-garbage` (deletes brands) and `/api/fix-data` (rewrites catalog data) run on a plain `GET` protected only by `?key=INTERNAL_API_KEY` in production and **unprotected outside production**; `/api/debug-session` and `/api/debug/inspect-as` expose only the caller's own session and catalog names. Decision D9 (keep, restrict or delete) is still open.
18. **Order actions use their own broad role list** (website, order domain): `assignRider`, `restoreOrder`, `deleteOrder` and `updateOrderHubStatus` (`requirePartnerOrAbove`, session role) and `/api/admin/orders/*` allow PARTNER, RELATIONSHIP_MANAGER and ZONAL_HEAD on any order, without checking that the order is in their pincodes; `deleteOrder` is not used by any page. To be fixed with the order migration.
19. **Permissions that need a business decision** (kept as the current pages behave): an ADMIN may grant ADMIN and may remove a SUPER_ADMIN whose super-admin status comes only from the database role; a RELATIONSHIP_MANAGER has full partner management on the Partners page (any city and manager), like an admin; the sidebar shows "Field Executives" to RMs but the page refuses them; zonal heads may move a rider of their team to "no partner", after which they no longer see it.

### Still in the TypeScript backend (other domains)

The order functions in `actions/executive.ts` (`getExecutiveOrders`, `updateOrderStatus`, `submitVerification` — they can use `/api/executive/session`), order scoping in `app/admin/orders/page.tsx`, notifications (`actions/notifications.ts`, which take role/user id from the client), the email hub (role-based mailbox access), banner prices, and the debug routes (see finding 17; `/api/diagnose-user` was secured by the hardening). `revalidatePath` calls are a Next.js cache concern and stay in Next.js.

## Static catalog data

The Next.js app keeps part of the catalog in code. Copies live in `src/main/resources/catalog/`:

| File | Source |
|---|---|
| `catalog-2026.json` | `lib/catalog2026.ts → CATALOG_2026_MODELS` (generated) |
| `brand-default-images.json` | `lib/catalog2026.ts → BRAND_DEFAULT_IMAGES` (generated) |
| `default-core-brands.json` | `lib/store.ts → getBrands() → DEFAULT_CORE_BRANDS` (hand-copied) |

`Catalog2026SyncTest` fails the build if `catalog-2026.json` drifts from `lib/catalog2026.ts`. To regenerate the JSON **and** the golden test fixtures from the TypeScript source (requires Docker; run from the repository root):

```bash
docker run --rm -v "$PWD/lib:/src/lib:ro" -v "$PWD/backend/tools/catalog-sync:/tools:ro" -v "$PWD/backend/src:/out" node:22-alpine node --experimental-strip-types --no-warnings /tools/generate.mjs
```

## Tests

`mvn verify` runs (the PostgreSQL tests use Testcontainers and are **skipped if Docker is not running**):

- `AuthScenarioParityTest` — a 72-step scenario (`golden/auth-scenario.json`) executed by `scripts/security-tests/run.sh golden` against the **website** server actions (`actions/auth.ts`, `inlineAuth.ts`, `profile.ts`, `admin.ts`, `lib/session.ts` with Prisma, jose, bcryptjs, nodemailer → SMTP catcher). The test replays it over HTTP against Spring Boot on an identical empty database and requires identical outcomes for every step (returned value / redirect / thrown error), the session cookie each actor holds afterwards, the final `"User"` rows and the emails sent (`golden/auth-scenario-expected.json`). Covers successful and failed sign-in (email, phone, wrong password, unknown user, wildcard email), sign-up and OTP verification, password reset, quick register/login, profile, logout, session reads, identity overrides, and authorization (401/403, a PARTNER refused when granting ADMIN or listing admins, self/super-admin protection).
- `PricingCasesParityTest` — 1,842 price calculations evaluated by the **original** `calculatePrice` (Node.js, real Prisma) on `db/04-pricing-rules-seed.sql`: answer sets generated from the real questionnaire (`lib/data.ts`) for 15 categories (incl. `smartwatch`/`smarttv`, unknown, empty and missing category), 24 base prices around every floor boundary, about a third with type mutations, plus handcrafted edge cases; once with the seeded rules and once with an empty rules table (every hard-coded branch). Every result (price, `NaN` or "throws") must be identical through the service, and a sample of 120+ through the HTTP endpoint (`golden/pricing-cases.json`).
- `PricingScenarioParityTest` — 35 steps against the website code: rule listing (by category / all), upserts by SUPER_ADMIN and ADMIN (allowed), PARTNER, ZONAL_HEAD, RELATIONSHIP_MANAGER, FIELD_EXECUTIVE and USER (403) and anonymous (401), partial updates, Prisma's label requirement and integer truncation, new rules switching a category from hard-coded logic to rules, and quotes before/after; identical outcomes and final `"EvaluationRule"` table (`golden/pricing-scenario-expected.json`).
- `PriceCalculatorTest` — the pricing rules spelled out: floors and the 50,000 boundary, rounding down, rule matching (`'true'`/`'false'`, `!x`, strings), non-compounding percentages, bonuses, rules disabling the hard-coded logic, smartwatch vs watch, JavaScript type semantics.
- `StaffScenarioParityTest` — a 158-step scenario (`golden/staff-scenario.json`) on a fixed seed (`db/03-staff-seed.sql`: users of every role, cities, riders, orders) executed against the **website** implementation by `scripts/security-tests/run.sh golden`: server actions called directly, and the actual admin pages (riders, cities, zonal-heads, rm-dashboard, homepage, admins, home) rendered behind the admin layout with JSX captured as data — recording the props each page passes to its components and invoking the inline server actions found in the rendered output. Since the security hardening it includes the staff permissions of every role (role grants and revocations, partner and field-executive grants, team-limited rider management, admin-only pages and forms, landing page, pricing rules), allowed and refused city/partner changes for every role, zonal-head territory limits, legacy and hashed rider logins, refused onboarding take-overs, forged `executive_id` cookies, and relationship managers (a partner an RM grants becomes theirs; the RM dashboard shows only their partners and their routed orders). The test replays it against Spring Boot and requires identical outcomes for every step, identical session / `executive_id` cookies per actor (executive cookies compared by the rider they verify as), and identical final User (including `relationshipManagerId`) / Rider / City / Order (including `partnerId`) state, rider passwords compared by kind (`golden/staff-scenario-expected.json`).
- `SecurityHardeningIntegrationTest` — city writes judged by the database role (a still-valid cookie claiming ADMIN for a demoted user gets 403; a super-admin claim for a deleted account gets 401; an executive token used as a session gets 401) with nothing changed; zonal-head territory; only valid signed `executive_id` cookies identify a rider; onboarding cannot take over an executive; legacy plain-text passwords are replaced by hashes.
- `ExecutiveTokenCodecTest` — executive tokens byte-identical to the website's (`golden/executive-token-fixture.json`, produced by `lib/executive-session.ts`), expiry, and rejection of raw ids, tampered payloads, `alg: none`, other secrets, the session key, wrong type, missing expiry or subject, and user session tokens.
- `SensitiveLoggingIntegrationTest` — authentication flows log no password, hash, reset code, token or secret; a forced registration failure is logged without PostgreSQL's row detail (`logServerErrorDetail=false`).
- `RiderPasswordsTest` — bcrypt hashing compatible with bcryptjs, constant-time legacy comparison with re-hash, empty values.
- `StaffAdminIntegrationTest` — cookie attributes (session and signed `executive_id`), accepting cookies issued by Next.js and rejecting tampered ones, profile, role directory (placeholders, demotion side effect, no password data), zonal-head and partner administration including zonal-head scoping, 401/403 access control.
- `SessionTokenCodecTest` — tokens byte-identical to `jose`; accept/reject verdicts identical to `jose.jwtVerify` for 15 valid/hostile tokens (`golden/auth-fixtures.json`).
- `PasswordHasherTest` — hashes produced by `bcryptjs` verify (Unicode, 72-byte truncation, `$2a$`), new hashes use `$2b$10$`.
- `StaffPermissionsIntegrationTest` — each role against each protected staff operation over HTTP (grants and revocations, partner and field-executive grants with ordinary-account targets and zonal-head cities, partner lists, pricing rules, landing page, admin-only pages and forms, team-limited riders), including a still-valid cookie claiming ADMIN for an account that is USER.
- `AccessRulesTest`, `PhoneNumbersTest` — identity-override, staff-panel, phone and URL-encoding rules.
- `JsNumberJacksonConfigTest` — numbers formatted exactly like JavaScript.
- `CatalogPostgresIntegrationTest` — Hibernate validation with an unchanged schema fingerprint, database-enforced read-only catalog transactions, UTC handling, and 167 catalog API calls identical to the original TypeScript (`golden/catalog-api-expected.json`).
- `CatalogRulesGoldenTest`, `Catalog2026SyncTest`, catalog service and controller tests.

## Package structure

```
in.fonzkart.backend
├── FonzkartBackendApplication
├── shared/
│   ├── config/CoreConfig           Clock, mail executor, configuration properties scan
│   ├── id/Cuid                     Prisma cuid()-format ids
│   ├── mail/                       SMTP sending as in the original (MailService, MailTransport, EmailAccount read)
│   ├── text/JsText                 JavaScript string semantics (trim, toLowerCase, truthiness, encodeURIComponent)
│   ├── time/                       UTC enforcement, Prisma-compatible dates (JsDates)
│   └── web/                        ActionResponse, ActionException, ApiExceptionHandler (response contract),
│                                   JavaScript-compatible number serialisation
├── catalog/                        api · dto · entity · repository · rules · service · staticdata
├── city/                           "City" (read/write): cities page, pincode actions, homepage lists,
│                                   pincode availability, zonal-head city assignment; CityAccess (who may change
│                                   cities and partner territories, by database role)
├── rider/                          "Rider" (read/write): rider administration, FIELD_EXECUTIVE grants,
│                                   executive phone login (ExecutiveAuthService), RiderPasswords (bcrypt with
│                                   legacy plain-text upgrade)
├── order/                          READ-ONLY "Order" projection + mapPrismaOrderToAppOrder port (AppOrderMapper)
├── pricing/                        "EvaluationRule" (read/write); PriceCalculator (calculatePrice port),
│                                   JsValues (JavaScript value semantics), PricingService, PricingController
├── auth/
│   ├── api/AuthController          sign-in, sign-up, OTP, password reset, quick register/login, logout, session
│   ├── config/AuthProperties       AUTH_SECRET, super-admin / forced-user emails, app URL
│   ├── password/PasswordHasher     bcryptjs-compatible hashing
│   ├── rules/                      Roles, StaffAccess (who may do what, by database role), AccessRules (identity
│   │                               overrides, staff-panel entry), PhoneNumbers, OneTimePasswords
│   ├── service/AuthService         auth flows (+ email templates)
│   └── session/                    jose-compatible JWT codecs and cookies: user session (SessionTokenCodec,
│                                   SessionService), signed executive_id (ExecutiveTokenCodec, ExecutiveSessions)
└── user/
    ├── api/                        ProfileController, StaffController
    ├── dto/                        UserDto, response views (no password fields)
    ├── entity/                     "User" (read/write)
    ├── repository/                 Prisma-equivalent queries and single-statement updates
    └── service/                    profile, staff roles, role directory, partner and zonal-head administration,
                                    relationship-manager dashboard
```

New domains should follow the same layout (`<domain>/{api,dto,entity,repository,rules,service}`).
