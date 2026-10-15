import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { focusManager } from '@tanstack/react-query';

/**
 * Screens refresh their data when the app comes back to the foreground, so a change made on the website or in
 * another app (a new order, a status, a price) shows without reopening the app. Call once in the root layout.
 */
export function useRefreshOnAppFocus() {
  useEffect(() => {
    if (Platform.OS === 'web') return; // the browser's own focus events already do this
    const subscription = AppState.addEventListener('change', state => focusManager.setFocused(state === 'active'));
    return () => subscription.remove();
  }, []);
}
