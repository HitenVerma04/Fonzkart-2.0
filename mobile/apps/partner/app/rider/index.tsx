// Rider mode: the executive's pickups (the website's executive order list), refreshed every 20 s and on return.
import { useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Redirect, useNavigation, useRouter } from 'expo-router';
import { useExecutiveInbox, useExecutiveOrders, type AppOrder } from '@fonzkart/api';
import { ORDER_STATUS, isFailed, normalizeStatus } from '@fonzkart/core';
import { EmptyState, ErrorState, Loading, OrderCard, Segmented, colors, font, spacing } from '@fonzkart/ui';
import { slotOf } from '../../src/orderInfo';
import { usePartnerSession } from '../../src/session';

type Tab = 'todo' | 'hub' | 'done' | 'cancelled';

const tabOf = (o: AppOrder): Tab => {
  const s = normalizeStatus(o.status);
  if (isFailed(s)) return 'cancelled';
  if (s === ORDER_STATUS.PICKED_UP) return 'hub';
  if (s === ORDER_STATUS.COMPLETED) return 'done';
  return 'todo';
};


export default function RiderPickups() {
  const router = useRouter();
  const navigation = useNavigation();
  const { session, signOut } = usePartnerSession();
  const signedIn = session.status === 'executive';
  const orders = useExecutiveOrders(signedIn);
  const inbox = useExecutiveInbox(signedIn);
  const [tab, setTab] = useState<Tab>('todo');
  const unread = inbox.data?.filter(n => !n.isRead).length ?? 0;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/rider/inbox')} accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={8}>
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
  if (orders.isPending) return <Loading label="Loading your pickups…" />;
  if (orders.isError) return <ErrorState onRetry={() => orders.refetch()} />;

  const counts = { todo: 0, hub: 0, done: 0, cancelled: 0 } as Record<Tab, number>;
  orders.data.forEach(o => counts[tabOf(o)]++);
  const list = orders.data.filter(o => tabOf(o) === tab);

  return (
    <FlatList
      data={list}
      keyExtractor={o => o.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} />}
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={styles.hello}>Hello, {session.executive.name}</Text>
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { id: 'todo', label: 'To pick up', count: counts.todo },
              { id: 'hub', label: 'To hub', count: counts.hub },
              { id: 'done', label: 'Done', count: counts.done },
              { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
            ]}
          />
        </View>
      }
      ListEmptyComponent={<EmptyState message={tab === 'todo' ? 'No pickups assigned to you right now.' : 'Nothing here.'} />}
      renderItem={({ item }) => (
        <OrderCard
          orderNumber={item.orderNumber}
          device={item.device}
          price={item.price}
          status={item.status}
          date={item.date}
          audience="staff"
          subtitle={[item.user?.name, item.address, slotOf(item)].filter(Boolean).join(' · ')}
          onPress={() => router.push({ pathname: '/rider/[id]', params: { id: item.id } })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, maxWidth: 720, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.md, marginBottom: spacing.xs },
  hello: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  headerActions: { flexDirection: 'row', gap: spacing.lg, marginRight: spacing.sm },
  headerLink: { fontSize: font.small, fontWeight: '700', color: colors.green },
});
