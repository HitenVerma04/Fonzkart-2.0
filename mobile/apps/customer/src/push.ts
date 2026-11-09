// Phone notifications. Every notification in the customer's inbox (order updates) is also sent to their phone by the
// backend (backend push/PushService, through Expo's push service). Here the app:
//  - asks permission and registers this phone's Expo push token once the customer is signed in, and removes it again
//    at sign-out (pushApi);
//  - shows notifications that arrive while the app is open as a banner too, and refreshes the inbox;
//  - opens the order (or the inbox) when a notification is tapped.
// Android delivery needs the Firebase project's google-services.json in app.json; iPhone delivery needs the paid Apple
// Developer account (push key). Without them the token request fails quietly and the in-app inbox keeps working.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { orderKeys, pushApi, useSession } from '@fonzkart/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function phoneToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Order updates',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#16a34a',
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  return (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
}

function open(data: Record<string, unknown> | undefined) {
  const orderId = typeof data?.orderId === 'string' ? data.orderId : null;
  if (orderId) router.push({ pathname: '/orders/[id]', params: { id: orderId } });
  else router.push('/notifications');
}

/** Registers this phone for the signed-in customer and handles incoming and tapped notifications. */
export function usePushNotifications() {
  const { session } = useSession();
  const client = useQueryClient();
  const registered = useRef<string | null>(null);
  const userId = session.status === 'signedIn' ? session.user.id : null;

  // Register after sign-in (and for whoever signs in next on this phone); forget the phone at sign-out.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!userId) {
      const token = registered.current;
      registered.current = null;
      if (token) pushApi.unregister(token).catch(() => undefined);
      return;
    }
    let cancelled = false;
    phoneToken()
      .then(token => {
        if (cancelled || !token) return;
        registered.current = token;
        return pushApi.register(token, Platform.OS === 'ios' ? 'ios' : 'android', 'customer');
      })
      .catch(() => undefined); // no Firebase / Apple push set up yet, or offline: the inbox still works
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const received = Notifications.addNotificationReceivedListener(() => {
      void client.invalidateQueries({ queryKey: orderKeys.notifications });
    });
    const tapped = Notifications.addNotificationResponseReceivedListener(response => {
      void client.invalidateQueries({ queryKey: orderKeys.notifications });
      open(response.notification.request.content.data);
    });
    // A tap that started the app.
    const launch = Notifications.getLastNotificationResponse();
    if (launch) open(launch.notification.request.content.data);
    return () => {
      received.remove();
      tapped.remove();
    };
  }, [client]);
}
