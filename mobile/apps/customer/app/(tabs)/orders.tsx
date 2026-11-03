import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMyOrders, useSession } from '@fonzkart/api';
import { makeStyles, useColors } from '@fonzkart/ui';
import {
  EmptyState, ErrorState, MAX_CONTENT, OrderCard, PAGE_PADDING, SkeletonRows, SkeletonScreen, TabTitle, useTabBarSpace,
} from '../../src/design';

export default function MyOrders() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const bottom = useTabBarSpace();
  const { session } = useSession();
  const orders = useMyOrders(session.status === 'signedIn');
  const count = orders.data?.length;

  const body = () => {
    if (session.status === 'loading' || (session.status === 'signedIn' && orders.isPending)) {
      return (
        <SkeletonScreen label="Loading your orders" style={styles.pad}>
          <SkeletonRows count={4} image={44} trailing />
        </SkeletonScreen>
      );
    }
    if (session.status === 'signedOut') {
      return (
        <EmptyState icon="orders" title="Track every pickup" message="Sign in to see your orders and follow each pickup live."
          action={{ label: 'Sign in', onPress: () => router.push({ pathname: '/account/sign-in', params: { returnTo: '/orders' } }) }} />
      );
    }
    if (orders.isError) return <ErrorState error={orders.error} onRetry={() => orders.refetch()} />;
    return (
      <FlatList
        data={orders.data}
        keyExtractor={o => o.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()}
          colors={[colors.green]} tintColor={colors.green} />}
        ListEmptyComponent={
          <EmptyState icon="orders" title="No orders yet" message="Value a device to book your first free pickup."
            action={{ label: 'Sell a device', onPress: () => router.navigate('/') }} />
        }
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
  };

  return (
    <View style={styles.screen}>
      <TabTitle title="My orders" subtitle={count ? `${count} order${count === 1 ? '' : 's'}` : undefined} />
      {body()}
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  pad: { padding: PAGE_PADDING },
  list: { padding: PAGE_PADDING, paddingTop: 4, gap: 12, maxWidth: MAX_CONTENT, width: '100%', alignSelf: 'center', flexGrow: 1 },
}));
