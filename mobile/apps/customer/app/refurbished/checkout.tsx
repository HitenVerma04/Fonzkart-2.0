// Buying a refurbished device: delivery details and cash on delivery. The server prices the order and takes the device
// from stock; if someone else got the last one first, the message says so.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { buyKeys, usePlaceRefurbishedOrder, useRefurbishedStore, useSession, type RefurbishedOrder } from '@fonzkart/api';
import { formatInr } from '@fonzkart/core';
import { makeStyles } from '@fonzkart/ui';
import { networkMessage } from '../../src/authFlow';
import { Appear, Button, Card, ChoiceCard, EmptyState, ErrorState, Notice, Page, SkeletonCard, type } from '../../src/design';
import { DeliveryFields, useDeliveryForm } from '../../src/shop/DeliveryFields';

export default function RefurbishedCheckout() {
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const store = useRefurbishedStore();
  const placeOrder = usePlaceRefurbishedOrder();
  const form = useDeliveryForm();
  const [error, setError] = useState('');

  if (session.status !== 'signedIn') return <EmptyState icon="lock" message="Sign in to place your order." />;
  if (store.isPending) return <Page><SkeletonCard lines={4} /><SkeletonCard lines={3} /></Page>;
  if (store.isError) return <ErrorState error={store.error} onRetry={() => store.refetch()} />;
  const device = store.data.items.find(i => i.id === id);
  if (!device) {
    return (
      <EmptyState icon="buy" title="This device has been sold" message="See what else is in stock."
        action={{ label: 'Browse devices', onPress: () => router.navigate('/buy') }} />
    );
  }

  const place = async () => {
    setError('');
    try {
      const order = await placeOrder.mutateAsync({ deviceId: device.id, ...form.values });
      queryClient.setQueryData<RefurbishedOrder[]>(buyKeys.myOrders, old => [order, ...(old ?? []).filter(o => o.id !== order.id)]);
      router.dismissTo('/buy');
      router.push({ pathname: '/refurbished/order/[id]', params: { id: order.id, placed: '1' } });
    } catch (e) {
      setError(networkMessage(e));
      void store.refetch();
    }
  };

  return (
    <Page>
      <Appear>
        <Card title="Delivery address" icon="location">
          <DeliveryFields form={form} phoneHint="The delivery partner calls this number." />
        </Card>
      </Appear>
      <Appear index={1}>
        <Card title="Payment" icon="cash">
          <ChoiceCard label="Cash on delivery" description="Pay in cash or UPI when your device arrives." selected onPress={() => undefined} />
        </Card>
      </Appear>
      <Appear index={2}>
        <Card title="Order summary" icon="orders">
          <View style={styles.row}>
            <Text style={styles.rowName} numberOfLines={2}>{device.name}, {device.storage}</Text>
            <Text style={styles.rowValue}>{formatInr(device.price)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowName}>Delivery</Text>
            <Text style={[styles.rowValue, styles.green]}>Free</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.total}>To pay</Text>
            <Text style={styles.total}>{formatInr(device.price)}</Text>
          </View>
        </Card>
      </Appear>
      <Appear index={3} style={styles.footer}>
        {form.problem && !error ? <Notice text={form.problem} /> : null}
        {error ? <Notice tone="error" text={error} /> : null}
        <Button title={`Place order · ${formatInr(device.price)}`} icon="check" loading={placeOrder.isPending}
          disabled={!!form.problem} onPress={() => void place()} />
        <Text style={styles.small}>We'll confirm your order by phone. Check the device before you pay.</Text>
      </Appear>
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  rowName: { ...type.body, flex: 1, color: colors.textSoft },
  rowValue: { ...type.body, fontWeight: '600', color: colors.text },
  green: { color: colors.green },
  divider: { height: 1, backgroundColor: colors.border },
  total: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.navy },
  footer: { gap: 12 },
  small: { ...type.small, color: colors.muted },
}));
