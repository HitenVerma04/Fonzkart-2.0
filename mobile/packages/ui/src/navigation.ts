import { colors, type Palette } from './theme';

/** Header look for an expo-router Stack in the given palette. */
export const screenOptionsFor = (palette: Palette) => ({
  headerTintColor: palette.navy,
  headerTitleStyle: { fontWeight: '700' as const, color: palette.navy },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: palette.surface },
  headerBackButtonDisplayMode: 'minimal' as const,
  contentStyle: { backgroundColor: palette.background },
});

/** Shared header look for the expo-router Stack in every app (light). */
export const stackScreenOptions = screenOptionsFor(colors);
