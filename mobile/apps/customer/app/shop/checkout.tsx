// Screen guard checkout: delivery details and cash on delivery. The server prices the order from its own data; the
// summary here shows the same latest store prices.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { shopKeys, usePlaceShopOrder, useProfile, useScreenGuardStore, useSession, type ShopOrder } from '@fonzkart/api';
import { cleanPincode, formatInr, isCompletePincode } from '@fonzkart/core';
import { makeStyles } from '@fonzkart/ui';
import { networkMessage } from '../../src/authFlow';
import { Appear, Button, Card, ChoiceCard, EmptyState, ErrorState, Notice, Page, SkeletonCard, TextField, type } from '../../src/design';
import { clearCart, priceCart, useCart } from '../../src/shop/cart';

export default function Checkout() {
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const profile = useProfile(session.status === 'signedIn');
  const store = useScreenGuardStore();
  const cart = useCart();
  const placeOrder = usePlaceShopOrder();
  const totals = priceCart(cart, store.data?.items);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [error, setError] = useState('');

  // The account's name and phone (stored as +91XXXXXXXXXX) as defaults.
  useEffect(() => {
    if (!profile.data) return;
    setName(current => current || profile.data.name);
    const stored = profile.data.phone?.replace(/\D/g, '').slice(-10);
    if (stored) setPhone(current => current || stored);
  }, [profile.data]);

  if (session.status !== 'signedIn') return <EmptyState icon="lock" message="Sign in to place your order." />;
  if (store.isPending) return <Page><SkeletonCard lines={4} /><SkeletonCard lines={3} /></Page>;
  if (store.isError) return <ErrorState error={store.error} onRetry={() => store.refetch()} />;
  if (!totals.count) {
    return (
      <EmptyState icon="orders" title="Your cart is empty" message="Add a screen guard for your phone to get started."
        action={{ label: 'Browse screen guards', onPress: () => router.navigate('/screen-guard') }} />
    );
  }

  const problem = !name.trim() ? 'Enter your name.'
    : phone.length !== 10 ? 'Enter your 10-digit mobile number.'
    : address.trim().length < 10 ? 'Enter your full delivery address.'
    : !isCompletePincode(pincode) ? 'Enter your 6-digit pincode.'
    : '';

  const place = async () => {
    setError('');
    try {
      const order = await placeOrder.mutateAsync({
        items: totals.rows.map(r => ({ screenGuardId: r.item.id, quantity: r.quantity })),
        name: name.trim(),
        phone,
        address: address.trim(),
        pincode,
      });
      queryClient.setQueryData<ShopOrder[]>(shopKeys.myOrders, old => [order, ...(old ?? []).filter(o => o.id !== order.id)]);
      clearCart();
      router.dismissTo('/screen-guard');
      router.push({ pathname: '/shop/order/[id]', params: { id: order.id, placed: '1' } });
    } catch (e) {
      setError(networkMessage(e));
    }
  };

  return (
    <Page>
      <Appear>
        <Card title="Delivery address" icon="location">
          <TextField label="Full name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
          <TextField label="Mobile number" value={phone} onChangeText={text => setPhone(text.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad" prefix="+91" hint="The delivery partner calls this number." />
          <TextField label="House / flat, street, area" value={address} onChangeText={setAddress} multiline
            placeholder="e.g. 12, 2nd Cross, Indiranagar, Bengaluru" />
          <TextField label="Pincode" value={pincode} onChangeText={text => setPincode(cleanPincode(text))}
            keyboardType="number-pad" maxLength={6} />
        </Card>
      </Appear>

      <Appear index={1}>
        <Card title="Payment" icon="cash">
          <ChoiceCard label="Cash on delivery" description="Pay in cash or UPI when your guard arrives." selected onPress={() => undefined} />
        </Card>
      </Appear>

      <Appear index={2}>
        <Card title="Order summary" icon="orders">
          {totals.rows.map(({ item, quantity }) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.rowName} numberOfLines={2}>{quantity} × {item.name}</Text>
              <Text style={styles.rowValue}>{formatInr(item.price * quantity)}</Text>
            </View>
          ))}
          {totals.savings > 0 ? (
            <View style={styles.row}>
              <Text style={styles.rowName}>You save</Text>
              <Text style={[styles.rowValue, styles.green]}>{formatInr(totals.savings)}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.rowName}>Delivery</Text>
            <Text style={[styles.rowValue, styles.green]}>Free</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.total}>To pay</Text>
            <Text style={styles.total}>{formatInr(totals.payTotal)}</Text>
          </View>
        </Card>
      </Appear>

      <Appear index={3} style={styles.footer}>
        {problem && !error ? <Notice text={problem} /> : null}
        {error ? <Notice tone="error" text={error} /> : null}
        <Button title={`Place order · ${formatInr(totals.payTotal)}`} icon="check" loading={placeOrder.isPending}
          disabled={!!problem} onPress={() => void place()} />
        <Text style={styles.small}>We'll confirm your order by phone. Check the guard fits before you pay.</Text>
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
