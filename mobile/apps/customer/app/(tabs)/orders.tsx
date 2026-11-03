import { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMyOrders, useMyShopOrders, useSession, type ShopOrder } from '@fonzkart/api';
import { formatInr } from '@fonzkart/core';
import { formatDateTime, makeStyles, useColors } from '@fonzkart/ui';
import {
  EmptyState, ErrorState, Icon, MAX_CONTENT, OrderCard, PAGE_PADDING, radii, Segmented, SkeletonRows, SkeletonScreen, TabTitle, Tap,
  type, useDesign, useTabBarSpace,
} from '../../src/design';
import { ShopStatusBadge } from '../../src/shop/ShopBits';

type Kind = 'pickups' | 'shop';

export default function MyOrders() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const bottom = useTabBarSpace();
  const { session } = useSession();
  const [kind, setKind] = useState<Kind>('pickups');
  const signedIn = session.status === 'signedIn';
  const orders = useMyOrders(signedIn);
  const shopOrders = useMyShopOrders(signedIn && kind === 'shop');
  const active = kind === 'shop' ? shopOrders : orders;
  const count = active.data?.length;
  const refresh = <RefreshControl refreshing={active.isRefetching} onRefresh={() => void active.refetch()} colors={[colors.green]} tintColor={colors.green} />;

  const body = () => {
    if (session.status === 'loading' || (signedIn && active.isPending)) {
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
    if (active.isError) return <ErrorState error={active.error} onRetry={() => active.refetch()} />;
    if (kind === 'shop') {
      return (
        <FlatList
          data={shopOrders.data}
          keyExtractor={o => o.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={refresh}
          ListEmptyComponent={
            <EmptyState icon="shield" title="No shop orders yet" message="Screen guards you order show up here."
              action={{ label: 'Browse screen guards', onPress: () => router.push('/screen-guard') }} />
          }
          renderItem={({ item }) => (
            <ShopOrderCard order={item} onPress={() => router.push({ pathname: '/shop/order/[id]', params: { id: item.id } })} />
          )}
        />
      );
    }
    return (
      <FlatList
        data={orders.data}
        keyExtractor={o => o.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={refresh}
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
      {signedIn ? (
        <View style={styles.switcher}>
          <Segmented<Kind> value={kind} onChange={setKind}
            options={[{ id: 'pickups', label: 'Device pickups', icon: 'truck' }, { id: 'shop', label: 'Shop orders', icon: 'shield' }]} />
        </View>
      ) : null}
      {body()}
    </View>
  );
}

function ShopOrderCard({ order, onPress }: { order: ShopOrder; onPress: () => void }) {
  const colors = useColors();
  const d = useDesign();
  const styles = useStyles();
  const units = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const first = order.items[0];
  const summary = first ? `${first.name}${order.items.length > 1 ? ` + ${order.items.length - 1} more` : ''}` : '';
  return (
    <Tap onPress={onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`Shop order ${order.orderNumber}, ${formatInr(order.total)}`}
      style={[styles.card, { boxShadow: d.shadow.sm }]}>
      <View style={styles.cardIcon}>
        <Icon name="shield" color={colors.green} size={22} filled />
      </View>
      <View style={styles.cardText}>
        <View style={styles.cardTop}>
          <Text style={styles.cardNumber}>Order #{order.orderNumber}</Text>
          <ShopStatusBadge status={order.status} />
        </View>
        <Text style={styles.cardSummary} numberOfLines={1}>{summary}</Text>
        <Text style={styles.cardMeta}>{formatDateTime(order.createdAt)} · {units} item{units === 1 ? '' : 's'}</Text>
        <Text style={styles.cardTotal}>{formatInr(order.total)}</Text>
      </View>
      <Icon name="chevronRight" color={colors.muted} size={18} />
    </Tap>
  );
}

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  pad: { padding: PAGE_PADDING },
  switcher: { paddingHorizontal: PAGE_PADDING, paddingBottom: 8, maxWidth: MAX_CONTENT, width: '100%', alignSelf: 'center' },
  list: { padding: PAGE_PADDING, paddingTop: 4, gap: 12, maxWidth: MAX_CONTENT, width: '100%', alignSelf: 'center', flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 14 },
  cardIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardNumber: { ...type.label, fontSize: 15, color: colors.navy },
  cardSummary: { ...type.body, fontSize: 14, color: colors.text },
  cardMeta: { ...type.small, fontSize: 12, color: colors.muted },
  cardTotal: { fontSize: 16, lineHeight: 21, fontWeight: '700', color: colors.navy },
}));
