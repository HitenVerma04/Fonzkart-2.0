import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, createQueryClient } from '@fonzkart/api';
import { stackScreenOptions } from '@fonzkart/ui';
import { tokenStorage } from '../src/tokenStorage';

const queryClient = createQueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider storage={tokenStorage}>
        <StatusBar style="dark" />
        <Stack screenOptions={stackScreenOptions}>
          <Stack.Screen name="index" options={{ headerShown: false, title: 'Home' }} />
          <Stack.Screen name="search" options={{ title: 'Search' }} />
          <Stack.Screen name="quote/questions" options={{ title: 'Device check' }} />
          <Stack.Screen name="quote/offer" options={{ title: 'Your offer' }} />
          <Stack.Screen name="account/index" options={{ title: 'Account' }} />
          <Stack.Screen name="account/sign-in" options={{ title: 'Sign in' }} />
          <Stack.Screen name="account/sign-up" options={{ title: 'Create account' }} />
          <Stack.Screen name="account/verify" options={{ title: 'Verify email' }} />
          <Stack.Screen name="account/forgot" options={{ title: 'Reset password' }} />
        </Stack>
      </SessionProvider>
    </QueryClientProvider>
  );
}
