// Notifications in the Partner app, for a partner and for a field executive (each has their own inbox): phone
// notifications (usePhonePush registers this phone for whoever is signed in, and a tap opens the order) and in-app
// notifications (a banner slides down when something new reaches the inbox while the app is open). Phone delivery
// needs this app's Firebase and EAS project set up; until then the banners and the inbox work on their own.
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { executiveApi, executiveKeys, notificationsApi, pushApi, staffKeys, useExecutiveInbox, useStaffInbox } from '@fonzkart/api';
import { InAppNotifier, usePhonePush, type InboxItem, type PushData } from '@fonzkart/ui';
import { usePartnerSession } from './session';

export function PartnerNotifications() {
  const { session } = usePartnerSession();
  const client = useQueryClient();
  const isPartner = session.status === 'partner';
  const isExecutive = session.status === 'executive';
  const staffInbox = useStaffInbox(isPartner);
  const executiveInbox = useExecutiveInbox(isExecutive);
  const ownerId = isPartner ? session.user.id : isExecutive ? session.executive.id : null;
  const refresh = () => void client.invalidateQueries({ queryKey: isExecutive ? executiveKeys.inbox : staffKeys.inbox });

  const openOrder = (orderId: string | null) => {
    if (isExecutive) {
      if (orderId) router.push({ pathname: '/rider/[id]', params: { id: orderId } });
      else router.push('/rider/inbox');
    } else if (isPartner) {
      if (orderId) router.push({ pathname: '/partner/order/[id]', params: { id: orderId } });
      else router.push('/partner/inbox');
    }
  };

  usePhonePush({
    ownerId,
    channelName: 'Pickups and orders',
    register: (token, platform) => pushApi.register(token, platform, 'partner'),
    unregister: token => pushApi.unregister(token),
    onArrive: refresh,
    onOpen: (data: PushData) => openOrder(typeof data?.orderId === 'string' ? data.orderId : null),
  });

  const items = isPartner ? staffInbox.data : isExecutive ? executiveInbox.data : undefined;
  return (
    <InAppNotifier
      items={items}
      onOpen={(item: InboxItem) => {
        if (!item.isRead) {
          const mark = isExecutive ? executiveApi.markRead(item.id) : notificationsApi.markRead(item.id);
          void mark.catch(() => undefined).then(refresh);
        }
        openOrder(item.orderId);
      }}
    />
  );
}
