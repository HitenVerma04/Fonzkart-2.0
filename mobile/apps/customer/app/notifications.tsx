import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { notificationsApi, orderKeys, useNotifications, useSession, type AppNotification } from '@fonzkart/api';
import { formatDateTime, makeStyles, useColors } from '@fonzkart/ui';
import {
  Button, EmptyState, ErrorState, IconBadge, MAX_CONTENT, PAGE_PADDING, SkeletonRows, SkeletonScreen, Tap, radii, type, useDesign,
} from '../src/design';

export default function Notifications() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useSession();
  const list = useNotifications(session.status === 'signedIn');

  if (session.status !== 'signedIn') return <EmptyState icon="bell" message="Sign in to see updates about your orders." />;
  if (list.isPending) {
    return (
      <SkeletonScreen label="Loading notifications" style={styles.pad}>
        <SkeletonRows count={6} image={40} />
      </SkeletonScreen>
    );
  }
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
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()}
        colors={[colors.green]} tintColor={colors.green} />}
      ListHeaderComponent={unread ? (
        <View style={styles.head}>
          <Text style={styles.count}>{unread} new</Text>
          <Button title="Mark all as read" variant="link" icon="check"
            onPress={() => void notificationsApi.markAllRead().catch(() => undefined).then(refresh)} />
        </View>
      ) : undefined}
      ListEmptyComponent={<EmptyState icon="bell" title="All caught up" message="No updates yet." />}
      renderItem={({ item }) => <Item item={item} onPress={() => void open(item)} />}
    />
  );
}

function Item({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  const d = useDesign();
  const styles = useStyles();
  return (
    <Tap onPress={onPress} scaleTo={0.98} accessibilityRole="button"
      accessibilityLabel={`${item.isRead ? '' : 'Unread. '}${item.title}. ${item.message}`}
      style={[styles.item, { boxShadow: d.shadow.sm }, !item.isRead && styles.unread]}>
      <IconBadge name="bell" size={40} />
      <View style={styles.itemText}>
        <View style={styles.itemTop}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          {!item.isRead ? <View style={styles.dot} /> : null}
        </View>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
      </View>
    </Tap>
  );
}

const useStyles = makeStyles(colors => ({
  pad: { padding: PAGE_PADDING },
  list: { padding: PAGE_PADDING, paddingBottom: 32, gap: 10, maxWidth: MAX_CONTENT, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { ...type.tiny, textTransform: 'uppercase', color: colors.green },
  item: { flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: 14 },
  unread: { borderColor: colors.greenBorder, backgroundColor: colors.greenSoft },
  itemText: { flex: 1, gap: 4 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, ...type.label, fontSize: 15, color: colors.text },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.green },
  message: { ...type.small, color: colors.textSoft },
  date: { ...type.small, fontSize: 11, color: colors.muted },
}));
