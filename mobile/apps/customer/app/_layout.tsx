import { useEffect, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider, type ErrorBoundaryProps, type NativeStackHeaderProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SessionProvider, createQueryClient } from '@fonzkart/api';
import { useRefreshOnAppFocus, useTheme } from '@fonzkart/ui';
import { AppHeader } from '../src/design';
import { FestiveProvider } from '../src/festive/FestiveProvider';
import { LaunchIntro } from '../src/LaunchIntro';
import { themeStorage } from '../src/themeStorage';
import { tokenStorage } from '../src/tokenStorage';

const queryClient = createQueryClient();

/**
 * If the app fails while drawing, show what went wrong instead of closing: the native splash is hidden here too (the
 * launch animation that normally hides it may never have run), so the app never sits frozen on the splash.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    SplashScreen.hide();
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12, backgroundColor: '#f4f7f5' }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: '#0b2316' }}>Something went wrong</Text>
      <Text style={{ fontSize: 14, color: '#64766c', textAlign: 'center' }} selectable>{error.message}</Text>
      <Pressable onPress={() => void retry()} accessibilityRole="button"
        style={{ marginTop: 8, backgroundColor: '#16a34a', borderRadius: 999, paddingHorizontal: 28, paddingVertical: 14 }}>
        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  useRefreshOnAppFocus();
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider storage={tokenStorage}>
        <FestiveProvider storage={themeStorage}>
          <Screens />
          <LaunchIntro />
        </FestiveProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

function Screens() {
  const { scheme, colors } = useTheme();
  // The native window behind every screen: without this it stays white and flashes through while a screen slides
  // in or out in dark mode.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);
  // Pushed screens slide in from the right (the iOS motion on both platforms), under the app's own header.
  const screenOptions = useMemo(() => ({
    // Rendered as a component (not called as a function), so its hooks stay its own.
    header: (props: NativeStackHeaderProps) => <AppHeader {...props} />,
    animation: 'ios_from_right' as const,
    contentStyle: { backgroundColor: colors.background },
  }), [colors]);
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
        <Stack.Screen name="search" options={{ title: 'Search', animation: 'fade_from_bottom' }} />
        <Stack.Screen name="quote/questions" options={{ title: 'Device check' }} />
        <Stack.Screen name="quote/offer" options={{ title: 'Your offer' }} />
        <Stack.Screen name="account/sign-in" options={{ title: 'Sign in', animation: 'fade_from_bottom' }} />
        <Stack.Screen name="account/sign-up" options={{ title: 'Create account' }} />
        <Stack.Screen name="account/verify" options={{ title: 'Verify email' }} />
        <Stack.Screen name="account/forgot" options={{ title: 'Reset password' }} />
        <Stack.Screen name="book" options={{ title: 'Book pickup' }} />
        <Stack.Screen name="orders/[id]" options={{ title: 'Order' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="bulk" options={{ title: 'Bulk orders' }} />
        <Stack.Screen name="screen-guard" options={{ title: 'Screen guards' }} />
        <Stack.Screen name="shop/cart" options={{ title: 'Cart' }} />
        <Stack.Screen name="shop/checkout" options={{ title: 'Checkout' }} />
        <Stack.Screen name="shop/order/[id]" options={{ title: 'Order' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
