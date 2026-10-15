// Every order the signed-in staff member may see (scope: lib/order-access.ts on the server), by status, with search.
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStaffOrders, type AppOrder } from '@fonzkart/api';
import { ORDER_STATUS, isFailed, normalizeStatus } from '@fonzkart/core';
import { EmptyState, ErrorState, Loading, OrderCard, SearchField, Segmented, colors, font, spacing } from '@fonzkart/ui';

type Filter = 'all' | 'new' | 'review' | 'active' | 'picked' | 'hub' | 'failed';

const filterOf = (o: AppOrder): Exclude<Filter, 'all'> => {
  const s = normalizeStatus(o.status);
  if (isFailed(s)) return 'failed';
  if (s === ORDER_STATUS.PRICE_REVIEW) return 'review';
  if (s === ORDER_STATUS.PICKED_UP) return 'picked';
  if (s === ORDER_STATUS.COMPLETED) return 'hub';
  if (s === ORDER_STATUS.ASSIGNED) return 'active';
  return 'new';
};

export default function Orders() {
  const router = useRouter();
  const page = useStaffOrders(true);
  const [filter, setFilter] = useState<Filter>('new');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (page.data?.orders ?? []).filter(o => (filter === 'all' || filterOf(o) === filter) && (!q
      || `#${o.orderNumber} ${o.device} ${o.user?.name ?? ''} ${o.user?.phone ?? ''} ${o.pincode ?? ''} ${o.address}`.toLowerCase().includes(q)));
  }, [page.data, filter, query]);

  if (page.isPending) return <Loading label="Loading orders…" />;
  if (page.isError) return <ErrorState onRetry={() => page.refetch()} />;

  const counts: Record<Filter, number> = { all: page.data.orders.length, new: 0, review: 0, active: 0, picked: 0, hub: 0, failed: 0 };
  page.data.orders.forEach(o => counts[filterOf(o)]++);
  const partnerName = (id: string | null) => page.data.partners.find(p => p.id === id)?.name;
  const riderName = (id: string | null) => page.data.riders.find(r => r.id === id)?.name;

  return (
    <FlatList
      data={visible}
      keyExtractor={o => o.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={page.isRefetching} onRefresh={() => void page.refetch()} />}
      ListHeaderComponent={
        <View style={styles.head}>
          {page.data.territory.length ? <Text style={styles.muted}>Territory: {page.data.territory.join(', ')}</Text> : null}
          <SearchField placeholder="Search order #, device, customer, pincode" value={query} onChangeText={setQuery} />
          <Segmented<Filter> value={filter} onChange={setFilter} options={[
            { id: 'new', label: 'New', count: counts.new },
            { id: 'review', label: 'Price review', count: counts.review },
            { id: 'active', label: 'Assigned', count: counts.active },
            { id: 'picked', label: 'Picked up', count: counts.picked },
            { id: 'hub', label: 'At hub', count: counts.hub },
            { id: 'failed', label: 'Failed', count: counts.failed },
            { id: 'all', label: 'All', count: counts.all },
          ]} />
        </View>
      }
      ListEmptyComponent={<EmptyState message="No orders here." />}
      renderItem={({ item }) => (
        <OrderCard
          orderNumber={item.orderNumber}
          device={item.device}
          price={item.price}
          status={item.status}
          date={item.date}
          audience="staff"
          subtitle={[item.user?.name, item.pincode, partnerName(item.partnerId) ?? (item.partnerId ? null : 'Unrouted'), riderName(item.riderId)]
            .filter(Boolean).join(' · ')}
          onPress={() => router.push({ pathname: '/orders/[id]', params: { id: item.id } })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.sm, marginBottom: spacing.xs },
  muted: { fontSize: font.small, color: colors.muted },
});
