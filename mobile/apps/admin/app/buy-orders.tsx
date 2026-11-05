// Refurbished device orders from the Customer app (cash on delivery), newest first. Staff move each order along or
// cancel it; cancelling puts the device back on sale.
import { useState } from 'react';
import { Alert, FlatList, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { SHOP_ORDER_STATUSES, buyAdminApi, buyKeys, useBuyAdminOrders, type RefurbishedOrder, type ShopOrderStatus } from '@fonzkart/api';
import { formatInr } from '@fonzkart/core';
import { EmptyState, ErrorState, Loading, Notice, Segmented, colors, font, formatDateTime, radius, spacing } from '@fonzkart/ui';

const statusLabel = (id: string) => SHOP_ORDER_STATUSES.find(s => s.id === id)?.label ?? id;

export default function BuyOrders() {
  const client = useQueryClient();
  const orders = useBuyAdminOrders();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (orders.isPending) return <Loading />;
  if (orders.isError) return <ErrorState onRetry={() => orders.refetch()} />;

  const apply = async (o: RefurbishedOrder, status: ShopOrderStatus) => {
    setBusy(o.id);
    setMessage(null);
    try {
      const r = await buyAdminApi.setOrderStatus(o.id, status);
      if (r.error) setMessage({ tone: 'error', text: r.error });
      else {
        setMessage({ tone: 'success', text: `Order #${o.orderNumber} is now ${statusLabel(status).toLowerCase()}.` });
        await client.invalidateQueries({ queryKey: buyKeys.adminOrders });
        await client.invalidateQueries({ queryKey: buyKeys.admin });
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not update the order.' });
    } finally {
      setBusy(null);
    }
  };

  const change = (o: RefurbishedOrder, status: ShopOrderStatus) => {
    if (status === o.status) return;
    if (status !== 'cancelled') {
      void apply(o, status);
      return;
    }
    const text = `Cancel order #${o.orderNumber} for ${o.name}? The device goes back on sale.`;
    if (Platform.OS === 'web') {
      if ((globalThis as { confirm?: (t: string) => boolean }).confirm?.(text)) void apply(o, status);
      return;
    }
    Alert.alert('Cancel this order?', text, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel order', style: 'destructive', onPress: () => void apply(o, status) },
    ]);
  };

  return (
    <FlatList
      data={orders.data}
      keyExtractor={o => o.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} />}
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={styles.muted}>Refurbished devices ordered in the Customer app, newest first. Payment is cash on delivery.</Text>
          {message ? <Notice tone={message.tone} text={message.text} /> : null}
        </View>
      }
      ListEmptyComponent={<EmptyState message="No device orders yet." />}
      renderItem={({ item: o }) => (
        <View style={[styles.order, o.status === 'cancelled' && styles.cancelled]}>
          <View style={styles.top}>
            <Text style={styles.number}>Order #{o.orderNumber}</Text>
            <Text style={styles.muted}>{formatDateTime(o.createdAt)}</Text>
          </View>
          <Text style={styles.name}>{o.name}</Text>
          <Text style={styles.muted} selectable>{o.phone}{o.customerEmail ? ` · ${o.customerEmail}` : ''}</Text>
          <View style={styles.itemRow}>
            <Text style={styles.itemName} numberOfLines={2}>{o.deviceName}, {o.storage} ({o.grade})</Text>
            <Text style={styles.total}>{formatInr(o.price)}</Text>
          </View>
          <Text style={styles.muted} selectable>{o.address}, {o.pincode}</Text>
          <Segmented options={SHOP_ORDER_STATUSES} value={o.status} onChange={s => (busy ? undefined : change(o, s))} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.md, marginBottom: spacing.xs },
  order: { gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  cancelled: { opacity: 0.6 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { fontSize: font.small, fontWeight: '800', color: colors.green },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.small, color: colors.muted },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xs },
  itemName: { flex: 1, fontSize: font.small, color: colors.text },
  total: { fontSize: font.heading, fontWeight: '800', color: colors.green },
});
