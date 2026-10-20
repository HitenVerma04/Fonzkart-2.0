# Fonzkart mobile apps

Three Android/iOS apps built with React Native + Expo (SDK 57, TypeScript, Expo Router, TanStack Query), all calling the Spring Boot backend in `../backend`.

| Folder | App | Android package | Status |
|---|---|---|---|
| `apps/customer` | Fonzkart | `in.fonzkart.customer` | Browse and search the catalog; device check (website questionnaire); final offer = the server's quote; pincode check and service-area request; booking (address, map pin, date and slot, payment method); my orders with the tracker; inbox; sign up with email code, sign in (email or phone), password reset; account with delete-my-account |
| `apps/partner` | Fonzkart Partner | `in.fonzkart.partner` | Rider mode (phone login): jobs, re-check with photos and IMEI scan, revised price, pickup, mark paid, inbox. Partner mode: order queue, assign executives, team, hub handover, payouts, inbox |
| `apps/admin` | Fonzkart Admin | `in.fonzkart.admin` | Menu by role (super admin, admin, zonal head, RM): orders and price approval, partners, executives, cities, zonal heads, users, RM dashboard, pricing rules, catalog editing with images, home page banner prices, email, inbox |
| `packages/api` | `@fonzkart/api` | | Backend client (Bearer token, uploads), all endpoints the apps use; TanStack Query hooks; `SessionProvider` (token storage is passed in by each app) |
| `packages/core` | `@fonzkart/core` | | Server addresses, picture URLs, ₹ formatting, categories, questionnaire rules, booking rules, order status (a copy of the website's `lib/order-status.ts`, checked by a test) |
| `packages/ui` | `@fonzkart/ui` | | Theme, logo (from `brand/`), tiles, fields, answer cards, order cards and tracker, layout pieces, prompts, inbox |
| `packages/staff` | `@fonzkart/staff` | | Screens shared by the Partner and Admin apps (order detail, team manager) |

Every app refreshes open order screens every 20 seconds and when it comes back on screen, so a change made on the website or in another app shows up there.

## Server addresses

The apps use the **Fonzkart 2.0 staging** servers by default (`packages/core/src/config.ts`):
- API: `https://api-v2.fonzkart.in`
- Pictures (website): `https://v2.fonzkart.in`

Override per build with `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WEB_URL`. Never point the apps at the production website or database before the order cutover (one-writer rule). Android release builds only allow https.

## Develop

Node 22 and npm. Keep `node_modules` out of OneDrive: work in a copy, or in a Docker volume as below.

```bash
npm install            # from mobile/: installs all workspaces
npm run typecheck      # all apps and packages
npm test               # unit tests; FONZKART_LIVE_API=1 npm test also checks the staging API contract
cd apps/customer && npx expo start   # Expo Go / dev build; press w for web
```

The web build is for quick checks only. The backend sends no CORS headers, so the browser needs a same-origin proxy for `/api` and `/actuator`; phones don't.

## Android APK

`tools/android-build/` holds a Docker image (Node 22, JDK 17, Android command-line tools) and the build script. The workspace must already be installed in the `/work` volume.

```bash
docker build -t fonzkart-android-build mobile/tools/android-build
docker run --rm -v fz-mobile:/work -v fz-android-sdk:/opt/android-sdk -v fz-gradle:/root/.gradle -v "$PWD/mobile/builds:/out" fonzkart-android-build customer
```

If the container can't download Gradle (on this PC, Docker reaches GitHub's download host slowly or not at all), download the zip named in `apps/<app>/android/gradle/wrapper/gradle-wrapper.properties` from services.gradle.org on the host, check its `.sha256`, and add `-v <folder with the zip>:/gradle-dist:ro` to the `docker run`.

The APK lands in `mobile/builds/fonzkart-<app>-<version>.apk` (arm64-v8a, which covers current Android phones; pass more ABIs after the app name if needed). It is signed with the Expo template's debug key, which is fine for installing directly on a phone. Google Play needs an upload key and an `.aab`; that comes with Play Console setup (P7).

## Store builds (EAS, Android and iPhone)

Each app has an `eas.json` with three profiles:

| Profile | Builds | Server |
|---|---|---|
| `preview` | Android APK and iPhone build for testers (internal distribution) | 2.0 staging (the defaults in `packages/core/src/config.ts`) |
| `simulator` | iPhone simulator build (no Apple account needed to run it) | 2.0 staging |
| `production` | Play `.aab` and App Store build | `https://api-v2.fonzkart.in` / `https://v2.fonzkart.in` (needs the DNS records first) |

Needs the Expo account (and for store builds the Play Console and Apple Developer accounts). Once per app, signed in as that account: `cd mobile/apps/<app> && npx eas-cli init` (adds the project id to `app.json`), then `npx eas-cli build --platform all --profile preview`. EAS creates and keeps the Android upload key and the Apple certificates; nobody needs to handle them by hand. `npx eas-cli submit --profile production` sends a build to Play internal testing / TestFlight.
