// The Customer app's festive theme (backend: ShopController). Administrators choose one in the Admin app; everyone who
// opens the Customer app then sees it, until it is switched off.
import { request } from './client';

export type FestiveThemeId = 'none' | 'republic' | 'independence' | 'diwali' | 'eid' | 'christmas';

/** The themes, in calendar order; `colors` are the three shown on the Admin app's preview. */
export const FESTIVE_THEMES: { id: Exclude<FestiveThemeId, 'none'>; label: string; greeting: string; when: string; colors: [string, string, string] }[] = [
  { id: 'republic', label: 'Republic Day', greeting: 'Happy Republic Day', when: '26 January', colors: ['#0a2a6b', '#ea6a0c', '#138808'] },
  { id: 'independence', label: 'Independence Day', greeting: 'Happy Independence Day', when: '15 August', colors: ['#e8590c', '#ffffff', '#138808'] },
  { id: 'eid', label: 'Eid', greeting: 'Eid Mubarak', when: 'Date changes each year', colors: ['#04342c', '#0b5d4e', '#d4a72c'] },
  { id: 'diwali', label: 'Diwali', greeting: 'Happy Diwali', when: 'October or November', colors: ['#3b0f52', '#c2570c', '#fbbf24'] },
  { id: 'christmas', label: 'Christmas', greeting: 'Merry Christmas', when: '25 December', colors: ['#7f1d1d', '#c81e1e', '#15803d'] },
];

export const festiveApi = {
  /** Public. */
  get: async (signal?: AbortSignal) => (await request<{ theme: FestiveThemeId }>('GET', '/api/app/theme', { signal })).data,
  /** Administrators. */
  set: async (theme: FestiveThemeId) =>
    (await request<{ success?: boolean; error?: string }>('PUT', '/api/app/admin/theme', { body: { theme } })).data ?? {},
};
