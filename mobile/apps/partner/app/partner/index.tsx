// Partner mode: the partner's orders (the website's Orders page for a PARTNER: orders routed to them plus unrouted
// orders in their pincodes), grouped by what needs doing. Refreshed every 20 s and when the app comes back.
import { useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Redirect, useNavigation, useRouter } from 'expo-router';
import { useStaffInbox, useStaffOrders } from '@fonzkart/api';
import { EmptyState, ErrorState, Loading, OrderCard, Segmented, colors, font, spacing } from '@fonzkart/ui';
import { slotOf } from '../../src/orderInfo';
import { QUEUE_LABELS as LABELS, queueOf, type Queue } from '../../src/queues';
import { usePartnerSession } from '../../src/session';

export default function PartnerOrders() {
  const router = useRouter();
  const navigation = useNavigation();
  const { session, signOut } = usePartnerSession();
  const signedIn = session.status === 'partner';
  const page = useStaffOrders(signedIn);
  const inbox = useStaffInbox(signedIn);
  const [queue, setQueue] = useState<Queue>('assign');
  const unread = inbox.data?.filter(n => !n.isRead).length ?? 0;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/partner/team')} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.headerLink}>Team</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/partner/inbox')} accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={8}>
            <Text style={styles.headerLink}>Inbox{unread ? ` (${unread})` : ''}</Text>
          </Pressable>
          <Pressable onPress={() => void signOut()} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.headerLink}>Sign out</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, router, signOut, unread]);

  if (!signedIn) return <Redirect href="/" />;
  if (page.isPending) return <Loading label="Loading orders…" />;
  if (page.isError) return <ErrorState onRetry={() => page.refetch()} />;

  const counts = Object.fromEntries(Object.keys(LABELS).map(k => [k, 0])) as Record<Queue, number>;
  page.data.orders.forEach(o => counts[queueOf(o)]++);
  const list = page.data.orders.filter(o => queueOf(o) === queue);
  const riderName = (id: string | null) => page.data.riders.find(r => r.id === id)?.name;

  return (
    <FlatList
      data={list}
      keyExtractor={o => o.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={page.isRefetching} onRefresh={() => void page.refetch()} />}
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={styles.hello}>{session.user.name}</Text>
          <Text style={styles.muted}>Your pincodes: {page.data.pincodes.join(', ') || 'none yet'}</Text>
          <Segmented<Queue>
            value={queue}
            onChange={setQueue}
            options={(Object.keys(LABELS) as Queue[]).map(id => ({ id, label: LABELS[id], count: counts[id] }))}
          />
        </View>
      }
      ListEmptyComponent={<EmptyState message="Nothing here right now." />}
      renderItem={({ item }) => (
        <OrderCard
          orderNumber={item.orderNumber}
          device={item.device}
          price={item.price}
          status={item.status}
          date={item.date}
          audience="staff"
          subtitle={[item.pincode, riderName(item.riderId) ? `Executive: ${riderName(item.riderId)}` : null, slotOf(item)].filter(Boolean).join(' · ')}
          onPress={() => router.push({ pathname: '/partner/order/[id]', params: { id: item.id } })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, maxWidth: 720, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.sm, marginBottom: spacing.xs },
  hello: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  muted: { fontSize: font.small, color: colors.muted },
  headerActions: { flexDirection: 'row', gap: spacing.lg, marginRight: spacing.sm },
  headerLink: { fontSize: font.small, fontWeight: '700', color: colors.green },
});
