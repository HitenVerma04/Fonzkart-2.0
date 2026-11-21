// Phone notifications for the three apps. Every notification in a person's inbox (order updates, new orders, pincode
// requests, …) is also sent to their phones by the backend (backend push/PushService, through Expo's push service).
// Here an app:
//  - asks permission and registers this phone's Expo push token once someone is signed in, and removes it again at
//    sign-out (the app passes register/unregister: pushApi from @fonzkart/api);
//  - refreshes the inbox when a notification arrives while the app is open (the in-app banner, InAppNotifier, then
//    shows it; the system banner is not shown twice);
//  - opens what a tapped notification is about.
// Android delivery needs the app's Firebase google-services.json in app.json and an EAS project id; iPhone delivery
// needs the paid Apple Developer account. Without them the token request fails quietly and the in-app inbox and
// banners keep working.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  // While the app is open the in-app banner shows it; the notification still goes to the phone's list.
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export type PushData = Record<string, unknown> | undefined;

async function phoneToken(channelName: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: channelName,
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

/**
 * Registers this phone for whoever is signed in (`ownerId`: their user or executive id, null when signed out) and
 * handles incoming and tapped notifications.
 */
export function usePhonePush({ ownerId, channelName, register, unregister, onArrive, onOpen }: {
  ownerId: string | null;
  /** The Android notification channel's name in the phone's settings ("Order updates"). */
  channelName: string;
  register: (token: string, platform: 'ios' | 'android') => Promise<unknown>;
  unregister: (token: string) => Promise<unknown>;
  /** A notification arrived while the app was open: refresh the inbox. */
  onArrive: () => void;
  /** A notification was tapped: open what it is about (data.orderId, …). */
  onOpen: (data: PushData) => void;
}) {
  const registered = useRef<string | null>(null);
  const handlers = useRef({ register, unregister, onArrive, onOpen });
  handlers.current = { register, unregister, onArrive, onOpen };

  // Register after sign-in (and for whoever signs in next on this phone); forget the phone at sign-out.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!ownerId) {
      const token = registered.current;
      registered.current = null;
      if (token) handlers.current.unregister(token).catch(() => undefined);
      return;
    }
    let cancelled = false;
    phoneToken(channelName)
      .then(token => {
        if (cancelled || !token) return;
        registered.current = token;
        return handlers.current.register(token, Platform.OS === 'ios' ? 'ios' : 'android');
      })
      .catch(() => undefined); // no Firebase / Apple push set up yet, or offline: the inbox still works
    return () => { cancelled = true; };
  }, [ownerId, channelName]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const received = Notifications.addNotificationReceivedListener(() => handlers.current.onArrive());
    const tapped = Notifications.addNotificationResponseReceivedListener(response => {
      handlers.current.onArrive();
      handlers.current.onOpen(response.notification.request.content.data);
    });
    // A tap that started the app.
    const launch = Notifications.getLastNotificationResponse();
    if (launch) handlers.current.onOpen(launch.notification.request.content.data);
    return () => {
      received.remove();
      tapped.remove();
    };
  }, []);
}
