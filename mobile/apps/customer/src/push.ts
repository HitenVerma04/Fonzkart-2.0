// Notifications in the customer app: phone notifications (usePhonePush in @fonzkart/ui registers this phone for the
// signed-in customer and opens the order a tapped notification is about) and in-app notifications (useCustomerInbox
// feeds the banner, InAppNotifier, that announces a new update while the app is open). Android delivery needs the
// Firebase project's google-services.json in app.json; iPhone delivery needs the paid Apple Developer account. Without
// them the token request fails quietly and the inbox and the in-app banners keep working.
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { notificationsApi, orderKeys, pushApi, useNotifications, useSession, type AppNotification } from '@fonzkart/api';
import { usePhonePush, type PushData } from '@fonzkart/ui';

function openData(data: PushData) {
  const orderId = typeof data?.orderId === 'string' ? data.orderId : null;
  if (orderId) router.push({ pathname: '/orders/[id]', params: { id: orderId } });
  else router.push('/notifications');
}

/** Registers this phone for the signed-in customer and handles incoming and tapped notifications. */
export function usePushNotifications() {
  const { session } = useSession();
  const client = useQueryClient();
  usePhonePush({
    ownerId: session.status === 'signedIn' ? session.user.id : null,
    channelName: 'Order updates',
    register: (token, platform) => pushApi.register(token, platform, 'customer'),
    unregister: token => pushApi.unregister(token),
    onArrive: () => void client.invalidateQueries({ queryKey: orderKeys.notifications }),
    onOpen: openData,
  });
}

/** The inbox for the in-app banner, and what tapping a banner does (mark it read, open its order). */
export function useCustomerInbox() {
  const { session } = useSession();
  const client = useQueryClient();
  const inbox = useNotifications(session.status === 'signedIn');
  return {
    items: session.status === 'signedIn' ? inbox.data : undefined,
    open: (n: Pick<AppNotification, 'id' | 'isRead' | 'orderId'>) => {
      if (!n.isRead) {
        void notificationsApi.markRead(n.id).catch(() => undefined)
          .then(() => client.invalidateQueries({ queryKey: orderKeys.notifications }));
      }
      if (n.orderId) router.push({ pathname: '/orders/[id]', params: { id: n.orderId } });
      else router.push('/notifications');
    },
  };
}
