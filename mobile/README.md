# Fonzkart mobile apps

Three Android/iOS apps built with React Native + Expo (SDK 57, TypeScript, Expo Router, TanStack Query), all calling the Spring Boot backend in `../backend`.

| Folder | App | Android package | Status |
|---|---|---|---|
| `apps/customer` | Fonzkart | `in.fonzkart.customer` | Browse and search the catalog; device check (website questionnaire), final offer from the server price rules, pickup pincode check; sign up with email code, sign in (email or phone), password reset, account |
| `apps/partner` | Fonzkart Partner | `in.fonzkart.partner` | Branded welcome screen with server status |
| `apps/admin` | Fonzkart Admin | `in.fonzkart.admin` | Branded welcome screen with server status |
| `packages/api` | `@fonzkart/api` | | Backend client (Bearer token), catalog, questionnaire, price, pincode and auth endpoints; TanStack Query hooks; `SessionProvider` (token storage is passed in by each app) |
| `packages/core` | `@fonzkart/core` | | Server addresses, picture URLs, ₹ formatting, category list, questionnaire rules (as `components/sell/ChecklistWizard.tsx`), pincode input |
| `packages/ui` | `@fonzkart/ui` | | Theme, logo (from `brand/`), tiles, search field, buttons, text fields, answer cards, notices, loading/error states |

## Server addresses

The apps use the **Fonzkart 2.0 staging** servers by default (`packages/core/src/config.ts`):
- API: `https://meahm1pikssqh1txhzbivvn0.89.116.27.217.sslip.io`
- Pictures (website): `https://cxwpkuhlszvkq2olj2haiose.89.116.27.217.sslip.io`

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
