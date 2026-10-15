import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMyOrders, useSession } from '@fonzkart/api';
import { Button, EmptyState, ErrorState, Loading, OrderCard, colors, font, spacing } from '@fonzkart/ui';
import { PAGE_PADDING } from '../../src/grid';

export default function MyOrders() {
  const router = useRouter();
  const { session } = useSession();
  const orders = useMyOrders(session.status === 'signedIn');

  if (session.status === 'loading') return <Loading />;
  if (session.status === 'signedOut') {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Sign in to see your orders.</Text>
        <Button title="Sign in" onPress={() => router.push({ pathname: '/account/sign-in', params: { returnTo: '/orders' } })} />
      </View>
    );
  }
  if (orders.isPending) return <Loading label="Loading your orders…" />;
  if (orders.isError) return <ErrorState onRetry={() => orders.refetch()} />;

  return (
    <FlatList
      data={orders.data}
      keyExtractor={o => o.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} />}
      ListEmptyComponent={<EmptyState message="No orders yet. Value a device to book your first pickup." />}
      renderItem={({ item }) => (
        <OrderCard
          orderNumber={item.orderNumber}
          device={item.device}
          price={item.price}
          status={item.status}
          date={item.date}
          subtitle={item.executive ? `Executive: ${item.executive.name}` : undefined}
          onPress={() => router.push({ pathname: '/orders/[id]', params: { id: item.id } })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: PAGE_PADDING, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center', flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  text: { fontSize: font.body, color: colors.muted },
});
