import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createQueryClient } from '@fonzkart/api';
import { stackScreenOptions } from '@fonzkart/ui';

const queryClient = createQueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Fonzkart Admin' }} />
      </Stack>
    </QueryClientProvider>
  );
}
