import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, createQueryClient } from '@fonzkart/api';
import { stackScreenOptions, useRefreshOnAppFocus } from '@fonzkart/ui';
import { tokenStorage } from '../src/tokenStorage';

const queryClient = createQueryClient();

export default function RootLayout() {
  useRefreshOnAppFocus();
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider storage={tokenStorage}>
        <StatusBar style="dark" />
        <Stack screenOptions={stackScreenOptions}>
          <Stack.Screen name="index" options={{ headerShown: false, title: 'Fonzkart Admin' }} />
          <Stack.Screen name="orders/index" options={{ title: 'Orders' }} />
          <Stack.Screen name="orders/[id]" options={{ title: 'Order' }} />
          <Stack.Screen name="partners" options={{ title: 'Partners' }} />
          <Stack.Screen name="riders" options={{ title: 'Field executives' }} />
          <Stack.Screen name="cities" options={{ title: 'Cities' }} />
          <Stack.Screen name="zonal-heads" options={{ title: 'Zonal heads' }} />
          <Stack.Screen name="users" options={{ title: 'Users & roles' }} />
          <Stack.Screen name="rm" options={{ title: 'RM dashboard' }} />
          <Stack.Screen name="pricing" options={{ title: 'Pricing rules' }} />
          <Stack.Screen name="inbox" options={{ title: 'Notifications' }} />
          <Stack.Screen name="catalog/index" options={{ title: 'Catalog' }} />
          <Stack.Screen name="catalog/brand/[id]" options={{ title: 'Models' }} />
          <Stack.Screen name="catalog/model/[id]" options={{ title: 'Variants' }} />
          <Stack.Screen name="homepage" options={{ title: 'Landing page' }} />
          <Stack.Screen name="email/index" options={{ title: 'Email' }} />
          <Stack.Screen name="email/[id]" options={{ title: 'Message' }} />
          <Stack.Screen name="email/compose" options={{ title: 'New email' }} />
        </Stack>
      </SessionProvider>
    </QueryClientProvider>
  );
}
