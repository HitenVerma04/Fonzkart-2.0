import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createQueryClient } from '@fonzkart/api';
import { stackScreenOptions, useRefreshOnAppFocus } from '@fonzkart/ui';
import { PartnerSessionProvider } from '../src/session';

const queryClient = createQueryClient();

export default function RootLayout() {
  useRefreshOnAppFocus();
  return (
    <QueryClientProvider client={queryClient}>
      <PartnerSessionProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={stackScreenOptions}>
          <Stack.Screen name="index" options={{ headerShown: false, title: 'Fonzkart Partner' }} />
          <Stack.Screen name="rider/index" options={{ title: 'My pickups', headerBackVisible: false }} />
          <Stack.Screen name="rider/[id]" options={{ title: 'Pickup' }} />
          <Stack.Screen name="rider/check/[id]" options={{ title: 'Device check' }} />
          <Stack.Screen name="rider/inbox" options={{ title: 'Notifications' }} />
          <Stack.Screen name="partner/index" options={{ title: 'Orders', headerBackVisible: false }} />
          <Stack.Screen name="partner/order/[id]" options={{ title: 'Order' }} />
          <Stack.Screen name="partner/team" options={{ title: 'My field executives' }} />
          <Stack.Screen name="partner/inbox" options={{ title: 'Notifications' }} />
        </Stack>
      </PartnerSessionProvider>
    </QueryClientProvider>
  );
}
