// Where the apps get their data. Defaults are the Fonzkart 2.0 staging servers on Coolify; a build can override them
// with EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WEB_URL. Apps must never point at the production website or database.
const STAGING_API_URL = 'https://meahm1pikssqh1txhzbivvn0.89.116.27.217.sslip.io';
const STAGING_WEB_URL = 'https://cxwpkuhlszvkq2olj2haiose.89.116.27.217.sslip.io';

const trimSlash = (url: string) => url.replace(/\/+$/, '');

export const config = {
  /** Spring Boot backend (catalog, auth, pricing...). */
  apiUrl: trimSlash(process.env.EXPO_PUBLIC_API_URL || STAGING_API_URL),
  /** Website: serves model pictures and uploaded brand logos (paths like /models/... and /uploads/...). */
  webUrl: trimSlash(process.env.EXPO_PUBLIC_WEB_URL || STAGING_WEB_URL),
};
