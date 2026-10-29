// Light and dark mode. An app that wraps itself in <ThemeProvider> (the Customer app) follows the phone's setting or
// the customer's own choice (System / Light / Dark, kept by the app); everything else gets the light palette, so the
// Partner and Admin apps look exactly as before.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, StyleSheet, useColorScheme } from 'react-native';
import { darkColors, lightColors, type Palette } from './theme';

/** What StyleSheet.create accepts (React Native 0.88 does not export the type by name). */
type Styles = Parameters<typeof StyleSheet.create>[0];

export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'system' | 'light' | 'dark';

/** Where the app keeps the customer's choice (the Customer app uses SecureStore). */
export interface ThemeStorage {
  get(): Promise<string | null>;
  set(value: ThemePreference): Promise<void>;
}

type ThemeValue = {
  scheme: ColorScheme;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeValue>({
  scheme: 'light',
  colors: lightColors,
  preference: 'light',
  setPreference: () => undefined,
});

const PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];
const DEFAULT_PALETTES = { light: lightColors, dark: darkColors };

/** `palettes` lets an app use its own light and dark colours (the Customer app); the default is the shared pair. */
export function ThemeProvider({ storage, palettes = DEFAULT_PALETTES, children }: {
  storage?: ThemeStorage;
  palettes?: { light: Palette; dark: Palette };
  children: ReactNode;
}) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    storage?.get().then(saved => {
      if (saved && (PREFERENCES as string[]).includes(saved)) setPreferenceState(saved as ThemePreference);
    }).catch(() => undefined);
  }, [storage]);

  // Native parts (keyboard, alerts, switches) follow the same choice.
  useEffect(() => {
    Appearance.setColorScheme?.(preference === 'system' ? 'unspecified' : preference); // not on the web
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    storage?.set(next).catch(() => undefined);
  }, [storage]);

  const scheme: ColorScheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo(
    () => ({ scheme, colors: scheme === 'dark' ? palettes.dark : palettes.light, preference, setPreference }),
    [scheme, palettes, preference, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
export const useColors = () => useContext(ThemeContext).colors;

/**
 * Styles that use theme colours: `const useStyles = makeStyles(colors => ({ ... }))` at module level, then
 * `const styles = useStyles()` in the component. Each palette's style sheet is built once.
 */
export function makeStyles<S extends Styles>(factory: (colors: Palette) => S & Styles) {
  const cache = new Map<Palette, Readonly<S>>();
  return function useStyles(): Readonly<S> {
    const palette = useColors();
    let styles = cache.get(palette);
    if (!styles) {
      styles = StyleSheet.create(factory(palette));
      cache.set(palette, styles);
    }
    return styles;
  };
}
