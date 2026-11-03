// The screen guard cart: lines with steppers, the bill (MRP total, discount, free delivery, to pay) and the saving,
// priced from the latest store data. Checkout needs an account.
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GUARD_TYPES, useScreenGuardStore, useSession } from '@fonzkart/api';
import { formatInr } from '@fonzkart/core';
import { makeStyles, useColors } from '@fonzkart/ui';
import {
  ActionBar, Appear, Button, Card, EmptyState, ErrorState, Icon, Page, ProductImage, radii, SkeletonCard, SkeletonRows, Tap, type,
  useDesign,
} from '../../src/design';
import { MAX_QUANTITY, priceCart, setQuantity, useCart } from '../../src/shop/cart';
import { PriceBlock, Stepper } from '../../src/shop/ShopBits';

export default function Cart() {
  const styles = useStyles();
  const colors = useColors();
  const d = useDesign();
  const router = useRouter();
  const { session } = useSession();
  const store = useScreenGuardStore();
  const cart = useCart();
  const totals = priceCart(cart, store.data?.items);

  if (store.isPending) {
    return (
      <Page>
        <SkeletonRows count={2} image={56} trailing />
        <SkeletonCard lines={4} />
      </Page>
    );
  }
  if (store.isError) return <ErrorState error={store.error} onRetry={() => store.refetch()} />;
  if (!totals.count) {
    return (
      <EmptyState icon="orders" title="Your cart is empty" message="Add a screen guard for your phone to get started."
        action={{ label: 'Browse screen guards', onPress: () => router.navigate('/screen-guard') }} />
    );
  }

  const checkout = () => {
    if (session.status !== 'signedIn') {
      router.push({ pathname: '/account/sign-in', params: { returnTo: '/shop/cart' } });
    } else {
      router.push('/shop/checkout');
    }
  };

  return (
    <View style={styles.screen}>
      <Page>
        <Appear style={styles.lines}>
          {totals.rows.map(({ item, quantity }) => (
            <View key={item.id} style={[styles.line, { boxShadow: d.shadow.sm }]}>
              <View style={styles.thumb}>
                <ProductImage uri={item.imageUrl} label={item.name} size={60} kind="phone" />
              </View>
              <View style={styles.lineText}>
                <Text style={styles.lineType}>{GUARD_TYPES.find(t => t.id === item.guardType)?.label ?? item.guardType}</Text>
                <Text style={styles.lineName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.lineModel}>For {item.model.startsWith(item.brand) ? item.model : `${item.brand} ${item.model}`}</Text>
                <PriceBlock price={item.price * quantity} mrp={item.mrp * quantity} />
                <View style={styles.lineActions}>
                  <View style={styles.stepper}>
                    <Stepper quantity={quantity} max={MAX_QUANTITY} onChange={q => setQuantity(item.id, q)} label={item.name} />
                  </View>
                  <Tap onPress={() => setQuantity(item.id, 0)} scaleTo={0.9} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`}>
                    <Icon name="trash" color={colors.muted} size={20} />
                  </Tap>
                </View>
              </View>
            </View>
          ))}
        </Appear>

        {totals.savings > 0 ? (
          <Appear index={1} style={styles.savings}>
            <Icon name="sparkle" color={colors.greenDark} size={18} filled />
            <Text style={styles.savingsText}>You save {formatInr(totals.savings)} on this order</Text>
          </Appear>
        ) : null}

        <Appear index={2}>
          <Card title="Bill details" icon="wallet">
            <BillRow label="Item total (MRP)" value={formatInr(totals.mrpTotal)} />
            {totals.savings > 0 ? <BillRow label="Discount" value={`− ${formatInr(totals.savings)}`} green /> : null}
            <BillRow label="Delivery" value="Free" green />
            <View style={styles.divider} />
            <BillRow label="To pay" value={formatInr(totals.payTotal)} strong />
            <Text style={styles.note}>Cash on delivery. Pay when your guard arrives.</Text>
          </Card>
        </Appear>
      </Page>
      <ActionBar>
        <View style={styles.payBox}>
          <Text style={styles.payLabel}>To pay</Text>
          <Text style={styles.payValue}>{formatInr(totals.payTotal)}</Text>
        </View>
        <View style={styles.payButton}>
          <Button title={session.status === 'signedIn' ? 'Checkout' : 'Sign in to checkout'} onPress={checkout} />
        </View>
      </ActionBar>
    </View>
  );
}

function BillRow({ label, value, green, strong }: { label: string; value: string; green?: boolean; strong?: boolean }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.billRow}>
      <Text style={[styles.billLabel, strong && styles.billStrong]}>{label}</Text>
      <Text style={[styles.billValue, green && { color: colors.green }, strong && styles.billStrong]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  lines: { gap: 12 },
  line: { flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 12 },
  thumb: { width: 72, height: 72, borderRadius: radii.md, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  lineText: { flex: 1, gap: 3 },
  lineType: { ...type.tiny, fontSize: 10, textTransform: 'uppercase', color: colors.green },
  lineName: { ...type.label, fontSize: 15, color: colors.navy },
  lineModel: { ...type.small, fontSize: 12, color: colors.muted },
  lineActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  stepper: { width: 120 },
  savings: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: colors.greenBorder, borderRadius: radii.md, padding: 12 },
  savingsText: { ...type.label, color: colors.greenDark },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billLabel: { ...type.body, color: colors.textSoft },
  billValue: { ...type.body, fontWeight: '600', color: colors.text },
  billStrong: { fontSize: 17, fontWeight: '700', color: colors.navy },
  divider: { height: 1, backgroundColor: colors.border },
  note: { ...type.small, fontSize: 12, color: colors.muted },
  payBox: { justifyContent: 'center', paddingHorizontal: 8 },
  payLabel: { ...type.small, fontSize: 12, color: colors.muted },
  payValue: { fontSize: 20, lineHeight: 24, fontWeight: '800', color: colors.navy },
  payButton: { flex: 1 },
}));
