import { colors } from './theme';

/** Shared header look for the expo-router Stack in every app. */
export const stackScreenOptions = {
  headerTintColor: colors.navy,
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.white },
  headerBackButtonDisplayMode: 'minimal' as const,
  contentStyle: { backgroundColor: colors.background },
};
