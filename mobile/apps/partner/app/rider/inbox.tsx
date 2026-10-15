import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { executiveApi, executiveKeys, useExecutiveInbox } from '@fonzkart/api';
import { ErrorState, InboxList, Loading } from '@fonzkart/ui';

export default function RiderInbox() {
  const router = useRouter();
  const client = useQueryClient();
  const inbox = useExecutiveInbox(true);
  if (inbox.isPending) return <Loading />;
  if (inbox.isError) return <ErrorState onRetry={() => inbox.refetch()} />;
  const refresh = () => void client.invalidateQueries({ queryKey: executiveKeys.inbox });
  return (
    <InboxList
      items={inbox.data}
      refreshing={inbox.isRefetching}
      onRefresh={() => void inbox.refetch()}
      onMarkAll={() => void executiveApi.markAllRead().catch(() => undefined).then(refresh)}
      onOpen={item => {
        if (!item.isRead) void executiveApi.markRead(item.id).catch(() => undefined).then(refresh);
        if (item.orderId) router.push({ pathname: '/rider/[id]', params: { id: item.orderId } });
      }}
    />
  );
}
