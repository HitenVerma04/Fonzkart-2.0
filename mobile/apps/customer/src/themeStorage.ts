import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { ThemeStorage } from '@fonzkart/ui';

const KEY = 'fonzkart.appearance';

// The customer's System / Light / Dark choice, kept on the phone (SecureStore, like the session; localStorage on web).
export const themeStorage: ThemeStorage =
  Platform.OS === 'web'
    ? {
        get: async () => globalThis.localStorage?.getItem(KEY) ?? null,
        set: async value => globalThis.localStorage?.setItem(KEY, value),
      }
    : {
        get: () => SecureStore.getItemAsync(KEY),
        set: value => SecureStore.setItemAsync(KEY, value),
      };
