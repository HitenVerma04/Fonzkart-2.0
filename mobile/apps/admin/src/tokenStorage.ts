import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { TokenStorage } from '@fonzkart/api';

const KEY = 'fonzkart.admin.session';

// Phones keep the session token in the Android Keystore / iOS Keychain. The web build (used only for local checks)
// has no secure store and falls back to localStorage.
export const tokenStorage: TokenStorage =
  Platform.OS === 'web'
    ? {
        get: async () => globalThis.localStorage?.getItem(KEY) ?? null,
        set: async token => globalThis.localStorage?.setItem(KEY, token),
        remove: async () => globalThis.localStorage?.removeItem(KEY),
      }
    : {
        get: () => SecureStore.getItemAsync(KEY),
        set: token => SecureStore.setItemAsync(KEY, token),
        remove: () => SecureStore.deleteItemAsync(KEY),
      };
