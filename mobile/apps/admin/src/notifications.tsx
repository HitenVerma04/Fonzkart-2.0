// Notifications in the Admin app (admins, zonal heads, relationship managers): phone notifications (usePhonePush
// registers this phone for the signed-in staff member; a tap opens the order or the pincode requests) and in-app
// notifications (a banner slides down when something new reaches the inbox while the app is open: a new order, an
// unassigned pickup, a pincode request). Phone delivery needs this app's Firebase and EAS project set up; until then
// the banners and the inbox work on their own.
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { notificationsApi, pushApi, staffKeys, useSession, useStaffInbox } from '@fonzkart/api';
import { InAppNotifier, usePhonePush, type InboxItem, type PushData } from '@fonzkart/ui';
import { ADMIN_APP_ROLES } from './menu';

function openAbout(orderId: string | null, title: string) {
  if (orderId) router.push({ pathname: '/orders/[id]', params: { id: orderId } });
  else if (/pincode/i.test(title)) router.push('/pincode-requests');
  else router.push('/inbox');
}

export function AdminNotifications() {
  const { session } = useSession();
  const client = useQueryClient();
  const staff = session.status === 'signedIn' && ADMIN_APP_ROLES.includes(session.user.role) ? session.user : null;
  const inbox = useStaffInbox(!!staff);
  const refresh = () => void client.invalidateQueries({ queryKey: staffKeys.inbox });

  usePhonePush({
    ownerId: staff?.id ?? null,
    channelName: 'Orders and requests',
    register: (token, platform) => pushApi.register(token, platform, 'admin'),
    unregister: token => pushApi.unregister(token),
    onArrive: refresh,
    onOpen: (data: PushData) => openAbout(typeof data?.orderId === 'string' ? data.orderId : null, typeof data?.type === 'string' ? data.type : ''),
  });

  return (
    <InAppNotifier
      items={staff ? inbox.data : undefined}
      onOpen={(item: InboxItem) => {
        if (!item.isRead) void notificationsApi.markRead(item.id).catch(() => undefined).then(refresh);
        openAbout(item.orderId, item.title);
      }}
    />
  );
}
