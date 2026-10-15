import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { notificationsApi, orderKeys, useNotifications, useSession, type AppNotification } from '@fonzkart/api';
import { Button, EmptyState, ErrorState, Loading, colors, font, formatDateTime, radius, spacing } from '@fonzkart/ui';
import { PAGE_PADDING } from '../src/grid';

export default function Notifications() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useSession();
  const list = useNotifications(session.status === 'signedIn');

  if (session.status !== 'signedIn') return <EmptyState message="Sign in to see updates about your orders." />;
  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorState onRetry={() => list.refetch()} />;

  const refresh = () => void client.invalidateQueries({ queryKey: orderKeys.notifications });
  const open = async (n: AppNotification) => {
    if (!n.isRead) {
      await notificationsApi.markRead(n.id).catch(() => undefined);
      refresh();
    }
    if (n.orderId) router.push({ pathname: '/orders/[id]', params: { id: n.orderId } });
  };
  const unread = list.data.filter(n => !n.isRead).length;

  return (
    <FlatList
      data={list.data}
      keyExtractor={n => n.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      ListHeaderComponent={unread ? (
        <Button title={`Mark all ${unread} as read`} variant="link"
          onPress={() => void notificationsApi.markAllRead().catch(() => undefined).then(refresh)} />
      ) : null}
      ListEmptyComponent={<EmptyState message="No updates yet." />}
      renderItem={({ item }) => (
        <Pressable onPress={() => void open(item)} accessibilityRole="button"
          style={({ pressed }) => [styles.item, !item.isRead && styles.unread, pressed && styles.pressed]}>
          <View style={styles.itemTop}>
            <Text style={styles.title}>{item.title}</Text>
            {!item.isRead ? <View style={styles.dot} accessibilityLabel="Unread" /> : null}
          </View>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: PAGE_PADDING, gap: spacing.sm, maxWidth: 640, width: '100%', alignSelf: 'center', flexGrow: 1 },
  item: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  unread: { borderColor: '#bbf7d0', backgroundColor: colors.greenSoft },
  pressed: { opacity: 0.7 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: font.body, fontWeight: '700', color: colors.text, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  message: { fontSize: font.small, color: colors.textSoft },
  date: { fontSize: font.tiny, color: colors.muted },
});
