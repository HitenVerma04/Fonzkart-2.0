import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { notificationsApi, staffKeys, useStaffInbox } from '@fonzkart/api';
import { ErrorState, InboxList, Loading } from '@fonzkart/ui';

export default function AdminInbox() {
  const router = useRouter();
  const client = useQueryClient();
  const inbox = useStaffInbox(true);
  if (inbox.isPending) return <Loading />;
  if (inbox.isError) return <ErrorState onRetry={() => inbox.refetch()} />;
  const refresh = () => void client.invalidateQueries({ queryKey: staffKeys.inbox });
  return (
    <InboxList
      items={inbox.data}
      refreshing={inbox.isRefetching}
      onRefresh={() => void inbox.refetch()}
      onMarkAll={() => void notificationsApi.markAllRead().catch(() => undefined).then(refresh)}
      onOpen={item => {
        if (!item.isRead) void notificationsApi.markRead(item.id).catch(() => undefined).then(refresh);
        if (item.orderId) router.push({ pathname: '/orders/[id]', params: { id: item.orderId } });
      }}
    />
  );
}
