import { useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, createQueryClient } from '@fonzkart/api';
import { ThemeProvider, screenOptionsFor, useRefreshOnAppFocus, useTheme } from '@fonzkart/ui';
import { themeStorage } from '../src/themeStorage';
import { tokenStorage } from '../src/tokenStorage';

const queryClient = createQueryClient();

export default function RootLayout() {
  useRefreshOnAppFocus();
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider storage={tokenStorage}>
        <ThemeProvider storage={themeStorage}>
          <Screens />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

function Screens() {
  const { scheme, colors } = useTheme();
  // Screens opened from the tabs slide in from the right, with the back arrow in Fonzkart green.
  const screenOptions = useMemo(() => {
    const base = screenOptionsFor(colors);
    return { ...base, headerTintColor: colors.green, animation: 'slide_from_right' as const };
  }, [colors]);
  // React Navigation's own colours (behind screens while they slide) follow the same palette.
  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: colors.green, background: colors.background, card: colors.surface, text: colors.text, border: colors.border },
    };
  }, [scheme, colors]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
        <Stack.Screen name="search" options={{ title: 'Search' }} />
        <Stack.Screen name="quote/questions" options={{ title: 'Device check' }} />
        <Stack.Screen name="quote/offer" options={{ title: 'Your offer' }} />
        <Stack.Screen name="account/sign-in" options={{ title: 'Sign in' }} />
        <Stack.Screen name="account/sign-up" options={{ title: 'Create account' }} />
        <Stack.Screen name="account/verify" options={{ title: 'Verify email' }} />
        <Stack.Screen name="account/forgot" options={{ title: 'Reset password' }} />
        <Stack.Screen name="book" options={{ title: 'Book pickup' }} />
        <Stack.Screen name="orders/[id]" options={{ title: 'Order' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="bulk" options={{ title: 'Bulk orders' }} />
        <Stack.Screen name="screen-guard" options={{ title: 'Screen Guard' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
