// The festive looks an administrator can switch on (Admin app, "Festive theme"). Each one replaces the accent in the
// light and dark palettes and the gradients in the design extras; the rest of the app follows, as it reads those.
import { FESTIVE_THEMES, type FestiveThemeId } from '@fonzkart/api';
import type { Palette } from '@fonzkart/ui';
import { baseDesigns, customerDark, customerLight, customerPalettes, type Design } from './tokens';

type Look = {
  /** The accent on light backgrounds (white text must read on it), and its darker and lighter tints. */
  light: { accent: string; deep: string; soft: string; tint: string; border: string; background: string };
  /** The accent on dark backgrounds (dark text reads on it), its lighter shade, and the same as "r,g,b". */
  dark: { accent: string; bright: string; rgb: string };
  /** The header's gradient in light and dark mode. */
  hero: { light: string; dark: string };
  /** Small highlights on that header: the chip's fill and the text on it. */
  heroAccent: string;
  heroOnAccent: string;
  /** Dark cards ("Sell this device", the Fonzkart promise) and the highlight on them. */
  deepGradient: string;
  deepAccent: string;
};

const LOOKS: Record<Exclude<FestiveThemeId, 'none'>, Look> = {
  republic: {
    light: { accent: '#d9480f', deep: '#b93a0a', soft: '#fff4ec', tint: '#ffe3d1', border: '#ffc9a8', background: '#f6f6f8' },
    dark: { accent: '#fb923c', bright: '#fdba74', rgb: '251,146,60' },
    hero: {
      light: 'linear-gradient(170deg, #08245e 0%, #0f3a94 55%, #1c4fb8 100%)',
      dark: 'linear-gradient(170deg, #07163a 0%, #0b2460 50%, #05070d 100%)',
    },
    heroAccent: '#ffd8a8',
    heroOnAccent: '#7c2d12',
    deepGradient: 'linear-gradient(135deg, #060f26 0%, #0b2460 58%, #123a8c 100%)',
    deepAccent: '#fdba74',
  },
  independence: {
    light: { accent: '#138808', deep: '#0e6b06', soft: '#f1fbef', tint: '#dcf5d8', border: '#b9e8b2', background: '#fbf7f2' },
    dark: { accent: '#4ade80', bright: '#86efac', rgb: '74,222,128' },
    hero: {
      light: 'linear-gradient(170deg, #c2410c 0%, #e8590c 50%, #f08c00 100%)',
      dark: 'linear-gradient(170deg, #5c1f06 0%, #7c2d12 50%, #0a0705 100%)',
    },
    heroAccent: '#ffffff',
    heroOnAccent: '#0e6b06',
    deepGradient: 'linear-gradient(135deg, #1a0d05 0%, #4a1c08 55%, #0e4d0a 100%)',
    deepAccent: '#ffd8a8',
  },
  eid: {
    light: { accent: '#0b6b5a', deep: '#085346', soft: '#eefaf6', tint: '#d3f1e8', border: '#a9e2d2', background: '#f5f7f3' },
    dark: { accent: '#e6c35c', bright: '#f2d98c', rgb: '230,195,92' },
    hero: {
      light: 'linear-gradient(170deg, #04342c 0%, #0b5d4e 60%, #128271 100%)',
      dark: 'linear-gradient(170deg, #03261f 0%, #06403a 50%, #040807 100%)',
    },
    heroAccent: '#f2d98c',
    heroOnAccent: '#5b4300',
    deepGradient: 'linear-gradient(135deg, #021a16 0%, #05352d 58%, #0b5d4e 100%)',
    deepAccent: '#f2d98c',
  },
  diwali: {
    light: { accent: '#c2570c', deep: '#9a4408', soft: '#fff7ed', tint: '#ffedd5', border: '#fed7aa', background: '#faf6f1' },
    dark: { accent: '#fbbf24', bright: '#fcd34d', rgb: '251,191,36' },
    hero: {
      light: 'linear-gradient(170deg, #2b0a3d 0%, #5b1a6b 55%, #a8431a 100%)',
      dark: 'linear-gradient(170deg, #1e072b 0%, #3b0f52 50%, #0a0507 100%)',
    },
    heroAccent: '#fde68a',
    heroOnAccent: '#7c2d12',
    deepGradient: 'linear-gradient(135deg, #140418 0%, #3b0f52 58%, #7c2d12 100%)',
    deepAccent: '#fcd34d',
  },
  christmas: {
    light: { accent: '#c81e1e', deep: '#9b1c1c', soft: '#fef2f2', tint: '#fee2e2', border: '#fecaca', background: '#f7f5f4' },
    dark: { accent: '#f87171', bright: '#fca5a5', rgb: '248,113,113' },
    hero: {
      light: 'linear-gradient(170deg, #6b1414 0%, #991b1b 55%, #c81e1e 100%)',
      dark: 'linear-gradient(170deg, #3a0a0a 0%, #5c1010 50%, #0a0505 100%)',
    },
    heroAccent: '#bbf7d0',
    heroOnAccent: '#14532d',
    deepGradient: 'linear-gradient(135deg, #1a0606 0%, #5c1010 55%, #14532d 100%)',
    deepAccent: '#fecaca',
  },
};

export type FestiveLook = { palettes: { light: Palette; dark: Palette }; designs: { light: Design; dark: Design } };

function build(id: Exclude<FestiveThemeId, 'none'>): FestiveLook {
  const look = LOOKS[id];
  const { accent, deep, soft, tint, border, background } = look.light;
  const { accent: glow, bright, rgb } = look.dark;
  const note = (a: number, b: number) => ({ background: `rgba(${rgb},${a})`, border: `rgba(${rgb},${b})`, text: bright });
  const extras = { festive: id, heroAccent: look.heroAccent, heroOnAccent: look.heroOnAccent, deepGradient: look.deepGradient, deepAccent: look.deepAccent };
  return {
    palettes: {
      light: {
        ...customerLight, green: accent, greenDark: deep, greenPressed: deep, greenSoft: soft, greenTint: tint, greenBorder: border, background,
        ripple: `${accent}24`, info: { background: soft, border, text: deep }, warning: { background: soft, border, text: deep },
      },
      dark: {
        ...customerDark, green: glow, greenDark: bright, greenPressed: glow, greenSoft: `rgba(${rgb},0.08)`, greenTint: `rgba(${rgb},0.16)`,
        greenBorder: `rgba(${rgb},0.3)`, ripple: `rgba(${rgb},0.18)`, info: note(0.08, 0.3), warning: note(0.08, 0.3),
      },
    },
    designs: {
      light: {
        ...baseDesigns.light, ...extras, heroGradient: look.hero.light,
        greenGradient: `linear-gradient(135deg, ${accent} 0%, ${deep} 100%)`,
        shadow: { ...baseDesigns.light.shadow, green: `0px 8px 20px ${accent}52` },
      },
      dark: {
        ...baseDesigns.dark, ...extras, heroGradient: look.hero.dark,
        greenGradient: `linear-gradient(135deg, ${bright} 0%, ${glow} 100%)`,
        shadow: { ...baseDesigns.dark.shadow, green: `0px 8px 22px rgba(${rgb},0.28)` },
      },
    },
  };
}

const NORMAL: FestiveLook = { palettes: customerPalettes, designs: baseDesigns };
const BUILT = new Map<string, FestiveLook>(FESTIVE_THEMES.map(t => [t.id, build(t.id)]));

/** The look for a theme id; the normal green look for "none", or for an id this version of the app does not know. */
export function festiveLook(id: string | undefined): FestiveLook {
  return (id && BUILT.get(id)) || NORMAL;
}

/** "Happy Diwali", or null when no festive theme is on. */
export function festiveGreeting(id: FestiveThemeId): string | null {
  return FESTIVE_THEMES.find(t => t.id === id)?.greeting ?? null;
}
