// The Customer app's design system: Fonzkart green on white and neutral surfaces (light), or on near-black (dark).
// Green is the only accent; red appears only for errors. The palettes keep the shared Palette names so the shared
// @fonzkart/ui pieces pick them up too (ThemeProvider `palettes`).
import { useTheme, type ColorScheme, type Palette } from '@fonzkart/ui';

type Tone = { background: string; text: string };

export const customerLight: Palette = {
  navy: '#0b2316', // headings: deep green-black instead of navy
  green: '#16a34a',
  greenDark: '#15803d',
  greenPressed: '#15803d',
  greenSoft: '#f0fdf4',
  greenTint: '#dcfce7',
  greenBorder: '#bbf7d0',
  white: '#ffffff',
  background: '#f4f7f5',
  surface: '#ffffff',
  border: '#e2e9e5',
  track: '#d3ddd7',
  muted: '#64766c',
  text: '#0f1f17',
  textSoft: '#3a4d42',
  placeholder: '#e9efeb',
  danger: '#dc2626',
  ripple: 'rgba(22,163,74,0.14)',
  backdrop: 'rgba(5,20,12,0.45)',
  info: { background: '#f0fdf4', border: '#bbf7d0', text: '#14532d' },
  error: { background: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  warning: { background: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
  // Order status badges in shades of green and grey (statusTone() names stay as the website's).
  tones: {
    amber: { background: '#f0f4f1', text: '#3a4d42' },
    blue: { background: '#dcfce7', text: '#166534' },
    orange: { background: '#d1fae5', text: '#047857' },
    purple: { background: '#bbf7d0', text: '#14532d' },
    green: { background: '#16a34a', text: '#ffffff' },
    red: { background: '#fee2e2', text: '#b91c1c' },
    gray: { background: '#eef2ef', text: '#4b5c52' },
  } as Record<'amber' | 'blue' | 'orange' | 'purple' | 'green' | 'red' | 'gray', Tone>,
};

export const customerDark: Palette = {
  navy: '#effaf3',
  green: '#22c55e',
  greenDark: '#4ade80',
  greenPressed: '#16a34a',
  greenSoft: 'rgba(34,197,94,0.08)',
  greenTint: 'rgba(34,197,94,0.16)',
  greenBorder: 'rgba(74,222,128,0.3)',
  white: '#ffffff',
  background: '#060a08',
  surface: '#0e1511',
  border: 'rgba(255,255,255,0.08)',
  track: '#26332c',
  muted: '#8b9f93',
  text: '#e8f3ec',
  textSoft: '#bccbc2',
  placeholder: '#151e19',
  danger: '#f87171',
  ripple: 'rgba(74,222,128,0.18)',
  backdrop: 'rgba(0,0,0,0.6)',
  info: { background: 'rgba(34,197,94,0.08)', border: 'rgba(74,222,128,0.3)', text: '#bbf7d0' },
  error: { background: 'rgba(239,68,68,0.12)', border: 'rgba(248,113,113,0.35)', text: '#fecaca' },
  warning: { background: 'rgba(34,197,94,0.08)', border: 'rgba(74,222,128,0.3)', text: '#bbf7d0' },
  tones: {
    amber: { background: 'rgba(255,255,255,0.08)', text: '#c9d6ce' },
    blue: { background: 'rgba(34,197,94,0.16)', text: '#86efac' },
    orange: { background: 'rgba(16,185,129,0.18)', text: '#6ee7b7' },
    purple: { background: 'rgba(74,222,128,0.22)', text: '#bbf7d0' },
    green: { background: '#22c55e', text: '#03140a' },
    red: { background: 'rgba(239,68,68,0.18)', text: '#fca5a5' },
    gray: { background: 'rgba(255,255,255,0.06)', text: '#bccbc2' },
  },
};

export const customerPalettes = { light: customerLight, dark: customerDark };

/** Rounded corners: generous, like the apps this design follows. */
export const radii = { xs: 8, sm: 12, md: 16, lg: 20, xl: 28, pill: 999 };

/** Type scale. Headings are heavy and slightly tight; body text stays at 15. */
export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const, letterSpacing: -0.8 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '600' as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  tiny: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 0.6 },
};

/** Springs and durations shared by every animation. Damped enough that nothing visibly bounces. */
export const motion = {
  press: { damping: 26, stiffness: 420, mass: 0.6 },
  gentle: { damping: 28, stiffness: 190, mass: 0.8 },
  snappy: { damping: 28, stiffness: 300, mass: 0.7 },
  fast: 160,
  base: 260,
  slow: 420,
};

/** Width used by page content on tablets and the web; phones use the full width. */
export const MAX_CONTENT = 640;

export type Design = {
  scheme: ColorScheme;
  /** Text and icons on a green fill. */
  onGreen: string;
  /** The brand gradient for primary buttons and the home header. */
  greenGradient: string;
  heroGradient: string;
  /** Frosted surfaces: floating bars, selected cards, overlays. */
  glass: { fill: string; strongFill: string; border: string; sheen: string };
  shadow: { sm: string; md: string; lg: string; green: string };
  shimmer: string;
};

const LIGHT: Design = {
  scheme: 'light',
  onGreen: '#ffffff',
  greenGradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 55%, #15803d 100%)',
  heroGradient: 'linear-gradient(170deg, #0f7a37 0%, #16a34a 55%, #1fb257 100%)',
  glass: {
    fill: 'rgba(255,255,255,0.72)',
    strongFill: 'rgba(255,255,255,0.9)',
    border: 'rgba(255,255,255,0.85)',
    sheen: 'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 60%)',
  },
  shadow: {
    sm: '0px 1px 2px rgba(11,35,22,0.06), 0px 2px 8px rgba(11,35,22,0.05)',
    md: '0px 4px 16px rgba(11,35,22,0.08)',
    lg: '0px 12px 32px rgba(11,35,22,0.14)',
    green: '0px 8px 20px rgba(22,163,74,0.32)',
  },
  shimmer: 'rgba(255,255,255,0.75)',
};

const DARK: Design = {
  scheme: 'dark',
  onGreen: '#03140a',
  greenGradient: 'linear-gradient(135deg, #4ade80 0%, #22c55e 55%, #16a34a 100%)',
  heroGradient: 'linear-gradient(170deg, #0a2a17 0%, #0b3a1f 45%, #060a08 100%)',
  glass: {
    fill: 'rgba(20,30,24,0.72)',
    strongFill: 'rgba(16,24,20,0.92)',
    border: 'rgba(255,255,255,0.1)',
    sheen: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 60%)',
  },
  shadow: {
    sm: '0px 1px 2px rgba(0,0,0,0.4)',
    md: '0px 6px 18px rgba(0,0,0,0.45)',
    lg: '0px 14px 36px rgba(0,0,0,0.55)',
    green: '0px 8px 22px rgba(34,197,94,0.28)',
  },
  shimmer: 'rgba(255,255,255,0.07)',
};

/** The design extras for the current light or dark mode (colours come from useColors()). */
export function useDesign(): Design {
  return useTheme().scheme === 'dark' ? DARK : LIGHT;
}
