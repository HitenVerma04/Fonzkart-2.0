// Where the apps get their data. Defaults are the Fonzkart 2.0 servers on Coolify (the 2.0 website has been live on
// fonzkart.in since 2026-11-09; the old site moved to v2.fonzkart.in); a build can override them with
// EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WEB_URL. Apps must never point at the old site or its database.
const STAGING_API_URL = 'https://api-v2.fonzkart.in';
const STAGING_WEB_URL = 'https://fonzkart.in';

const trimSlash = (url: string) => url.replace(/\/+$/, '');

export const config = {
  /** Spring Boot backend (catalog, auth, pricing...). */
  apiUrl: trimSlash(process.env.EXPO_PUBLIC_API_URL || STAGING_API_URL),
  /** Website: serves model pictures and uploaded brand logos (paths like /models/... and /uploads/...). */
  webUrl: trimSlash(process.env.EXPO_PUBLIC_WEB_URL || STAGING_WEB_URL),
};
