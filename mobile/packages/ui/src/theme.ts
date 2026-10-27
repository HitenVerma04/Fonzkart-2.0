// Fonzkart brand: navy wordmark #111827, brand green #16a34a (mobile/brand/). Two palettes with the same names: the
// light one (every app) and the dark one (the Customer app's dark mode, see ThemeContext). `white` stays white in
// both: it is text on green buttons and on pictures; screens and cards use `background` and `surface`.

type Tone = { background: string; text: string };

export const lightColors = {
  navy: '#111827',
  green: '#16a34a',
  /** Green text on light-green panels. */
  greenDark: '#15803d',
  /** A pressed green button. */
  greenPressed: '#15803d',
  greenSoft: '#f0fdf4',
  /** Selected-tab highlight, icon badges. */
  greenTint: '#dcfce7',
  greenBorder: '#bbf7d0',
  white: '#ffffff',
  background: '#f9fafb',
  surface: '#ffffff',
  border: '#e5e7eb',
  /** Lines between steps not reached yet. */
  track: '#d1d5db',
  muted: '#6b7280',
  text: '#111827',
  textSoft: '#374151',
  placeholder: '#f3f4f6',
  danger: '#dc2626',
  ripple: 'rgba(22, 163, 74, 0.16)',
  backdrop: 'rgba(17,24,39,0.45)',
  info: { background: '#eff6ff', border: '#bfdbfe', text: '#1e3a8a' },
  error: { background: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  warning: { background: '#fffbeb', border: '#fcd34d', text: '#92400e' },
  /** Order status badges. */
  tones: {
    amber: { background: '#fef3c7', text: '#92400e' },
    blue: { background: '#dbeafe', text: '#1d4ed8' },
    orange: { background: '#ffedd5', text: '#9a3412' },
    purple: { background: '#f3e8ff', text: '#7e22ce' },
    green: { background: '#dcfce7', text: '#15803d' },
    red: { background: '#fee2e2', text: '#b91c1c' },
    gray: { background: '#f3f4f6', text: '#4b5563' },
  } as Record<'amber' | 'blue' | 'orange' | 'purple' | 'green' | 'red' | 'gray', Tone>,
};

export type Palette = typeof lightColors;

export const darkColors: Palette = {
  navy: '#f9fafb',
  green: '#16a34a',
  greenDark: '#4ade80',
  greenPressed: '#15803d',
  greenSoft: '#052e16',
  greenTint: '#14532d',
  greenBorder: '#166534',
  white: '#ffffff',
  background: '#030712',
  surface: '#111827',
  border: '#1f2937',
  track: '#374151',
  muted: '#9ca3af',
  text: '#f9fafb',
  textSoft: '#d1d5db',
  placeholder: '#1f2937',
  danger: '#f87171',
  ripple: 'rgba(34, 197, 94, 0.22)',
  backdrop: 'rgba(0,0,0,0.6)',
  info: { background: 'rgba(59,130,246,0.15)', border: '#1e3a8a', text: '#bfdbfe' },
  error: { background: 'rgba(239,68,68,0.15)', border: '#7f1d1d', text: '#fecaca' },
  warning: { background: 'rgba(245,158,11,0.12)', border: '#92400e', text: '#fcd34d' },
  tones: {
    amber: { background: 'rgba(245,158,11,0.18)', text: '#fcd34d' },
    blue: { background: 'rgba(59,130,246,0.18)', text: '#93c5fd' },
    orange: { background: 'rgba(249,115,22,0.18)', text: '#fdba74' },
    purple: { background: 'rgba(168,85,247,0.18)', text: '#d8b4fe' },
    green: { background: 'rgba(34,197,94,0.18)', text: '#86efac' },
    red: { background: 'rgba(239,68,68,0.18)', text: '#fca5a5' },
    gray: { background: '#1f2937', text: '#d1d5db' },
  },
};

/** The light palette, for code outside a ThemeProvider (the Partner and Admin apps' own screens). */
export const colors = lightColors;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export const font = {
  title: 22,
  heading: 17,
  body: 15,
  small: 13,
  tiny: 11,
};
