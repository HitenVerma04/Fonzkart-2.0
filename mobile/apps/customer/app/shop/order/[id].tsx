// A screen guard order: the confirmation right after checkout, and its details from My orders.
import { RefreshControl, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMyShopOrders } from '@fonzkart/api';
import { formatInr } from '@fonzkart/core';
import { formatDateTime, makeStyles, useColors } from '@fonzkart/ui';
import { Appear, Card, EmptyState, ErrorState, InfoRow, Notice, Page, radii, SkeletonCard, SkeletonScreen, type, useDesign } from '../../../src/design';
import { PriceBlock, ShopStatusBadge } from '../../../src/shop/ShopBits';

export default function ShopOrderDetail() {
  const styles = useStyles();
  const colors = useColors();
  const d = useDesign();
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const orders = useMyShopOrders(true);

  if (orders.isPending) {
    return (
      <Page>
        <SkeletonScreen label="Loading your order">
          <SkeletonCard lines={2} tall />
          <SkeletonCard lines={4} />
        </SkeletonScreen>
      </Page>
    );
  }
  if (orders.isError) return <ErrorState message="Could not load this order." error={orders.error} onRetry={() => orders.refetch()} />;
  const o = orders.data.find(x => x.id === id);
  if (!o) return <EmptyState icon="orders" title="Order not found" message="This order is not on your account." />;
  const mrpTotal = o.items.reduce((sum, i) => sum + i.unitMrp * i.quantity, 0);

  return (
    <Page refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()}
      colors={[colors.green]} tintColor={colors.green} />}>
      {placed ? <Appear><Notice tone="success" text={`Order placed! Order #${o.orderNumber}. We'll call you to confirm delivery.`} /></Appear> : null}

      <Appear index={1}>
        <View style={[styles.summary, { boxShadow: d.shadow.md }]}>
          <View style={styles.top}>
            <Text style={styles.number}>Order #{o.orderNumber}</Text>
            <ShopStatusBadge status={o.status} />
          </View>
          <Text style={styles.date}>{formatDateTime(o.createdAt)}</Text>
          <Text style={styles.label}>To pay on delivery</Text>
          <PriceBlock price={o.total} mrp={mrpTotal} size="lg" />
        </View>
      </Appear>

      <Appear index={2}>
        <Card title="Items" icon="shield">
          {o.items.map(item => (
            <View key={item.screenGuardId} style={styles.item}>
              <View style={styles.itemText}>
                <Text style={styles.itemName}>{item.quantity} × {item.name}</Text>
                <Text style={styles.itemModel}>For {item.model}</Text>
              </View>
              <PriceBlock price={item.unitPrice * item.quantity} mrp={item.unitMrp * item.quantity} />
            </View>
          ))}
        </Card>
      </Appear>

      <Appear index={3}>
        <Card title="Delivery" icon="truck">
          <InfoRow icon="user" label="Name" value={o.name} />
          <InfoRow icon="phone" label="Mobile" value={`+91 ${o.phone}`} />
          <InfoRow icon="location" label="Address" value={`${o.address}, ${o.pincode}`} />
          <InfoRow icon="cash" label="Payment" value="Cash on delivery" />
        </Card>
      </Appear>
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  summary: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  number: { ...type.heading, fontSize: 18, color: colors.navy },
  date: { ...type.small, color: colors.muted },
  label: { ...type.small, fontWeight: '600', color: colors.muted, marginTop: 8 },
  item: { gap: 4, paddingVertical: 4 },
  itemText: { gap: 2 },
  itemName: { ...type.label, fontSize: 15, color: colors.text },
  itemModel: { ...type.small, fontSize: 12, color: colors.muted },
}));
