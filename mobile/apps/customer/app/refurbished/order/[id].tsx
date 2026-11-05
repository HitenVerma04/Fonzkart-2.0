// A refurbished device order: the confirmation right after checkout, and its details from My orders.
import { RefreshControl, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMyRefurbishedOrders } from '@fonzkart/api';
import { formatDateTime, makeStyles, useColors } from '@fonzkart/ui';
import { Appear, Card, EmptyState, ErrorState, InfoRow, Notice, Page, ProductImage, radii, SkeletonCard, type, useDesign } from '../../../src/design';
import { GradeBadge } from '../../../src/shop/GradeBadge';
import { PriceBlock, ShopStatusBadge } from '../../../src/shop/ShopBits';

export default function RefurbishedOrderDetail() {
  const styles = useStyles();
  const colors = useColors();
  const d = useDesign();
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const orders = useMyRefurbishedOrders(true);

  if (orders.isPending) return <Page><SkeletonCard lines={2} tall /><SkeletonCard lines={4} /></Page>;
  if (orders.isError) return <ErrorState message="Could not load this order." error={orders.error} onRetry={() => orders.refetch()} />;
  const o = orders.data.find(x => x.id === id);
  if (!o) return <EmptyState icon="orders" title="Order not found" message="This order is not on your account." />;

  return (
    <Page refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} colors={[colors.green]} tintColor={colors.green} />}>
      {placed ? <Appear><Notice tone="success" text={`Order placed! Order #${o.orderNumber}. We'll call you to confirm delivery.`} /></Appear> : null}
      <Appear index={1}>
        <View style={[styles.summary, { boxShadow: d.shadow.md }]}>
          <View style={styles.top}>
            <Text style={styles.number}>Order #{o.orderNumber}</Text>
            <ShopStatusBadge status={o.status} />
          </View>
          <Text style={styles.date}>{formatDateTime(o.createdAt)}</Text>
          <View style={styles.device}>
            <View style={styles.photo}><ProductImage uri={o.imageUrl} label={o.deviceName} size={72} /></View>
            <View style={styles.flex}>
              <Text style={styles.name}>{o.deviceName}</Text>
              <Text style={styles.date}>{o.storage}</Text>
              <GradeBadge grade={o.grade} />
            </View>
          </View>
          <Text style={styles.label}>To pay on delivery</Text>
          <PriceBlock price={o.price} mrp={o.mrp} size="lg" />
        </View>
      </Appear>
      <Appear index={2}>
        <Card title="Delivery" icon="truck">
          <InfoRow icon="user" label="Name" value={o.name} />
          <InfoRow icon="phone" label="Mobile" value={`+91 ${o.phone}`} />
          <InfoRow icon="location" label="Address" value={`${o.address}, ${o.pincode}`} />
          <InfoRow icon="cash" label="Payment" value="Cash on delivery" />
          {o.warrantyMonths > 0 ? <InfoRow icon="shield" label="Warranty" value={`${o.warrantyMonths} months`} /> : null}
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
  device: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  photo: { backgroundColor: '#ffffff', borderRadius: radii.md, padding: 4 },
  flex: { flex: 1, gap: 3 },
  name: { ...type.label, fontSize: 15, color: colors.text },
  label: { ...type.small, fontWeight: '600', color: colors.muted, marginTop: 10 },
}));
