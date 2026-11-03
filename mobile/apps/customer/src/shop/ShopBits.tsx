// Pieces of the screen guard shop: the price block (sale price, struck-through MRP, "% off"), the discount badge,
// the quantity stepper, the order status badge and the floating "View cart" bar.
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { discountPercent, SHOP_ORDER_STATUSES, type ShopOrderStatus } from '@fonzkart/api';
import { formatInr } from '@fonzkart/core';
import { makeStyles, useColors } from '@fonzkart/ui';
import { Icon, MAX_CONTENT, radii, Tap, type, useDesign } from '../design';

/** ₹749  ₹949  21% off — the struck MRP and the saving appear only when the price is below the MRP. */
export function PriceBlock({ price, mrp, size = 'md' }: { price: number; mrp: number; size?: 'md' | 'lg' }) {
  const styles = useStyles();
  const off = discountPercent(mrp, price);
  return (
    <View style={styles.priceRow} accessibilityLabel={off ? `${formatInr(price)}, was ${formatInr(mrp)}, ${off}% off` : formatInr(price)}>
      <Text style={[styles.price, size === 'lg' && styles.priceLg]}>{formatInr(price)}</Text>
      {off ? <Text style={[styles.mrp, size === 'lg' && styles.mrpLg]}>{formatInr(mrp)}</Text> : null}
      {off ? <Text style={[styles.off, size === 'lg' && styles.offLg]}>{off}% off</Text> : null}
    </View>
  );
}

/** "-21%" in the corner of a product card. */
export function DiscountBadge({ percent }: { percent: number }) {
  const styles = useStyles();
  if (!percent) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>-{percent}%</Text>
    </View>
  );
}

/** −  2  + in a green capsule. */
export function Stepper({ quantity, max, onChange, label }: { quantity: number; max: number; onChange: (q: number) => void; label: string }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.stepper} accessibilityLabel={`${label}: ${quantity} in cart`}>
      <Tap onPress={() => onChange(quantity - 1)} scaleTo={0.85} hitSlop={6} accessibilityRole="button"
        accessibilityLabel={quantity === 1 ? `Remove ${label}` : `One less ${label}`} style={styles.stepButton}>
        <Text style={styles.stepSign}>−</Text>
      </Tap>
      <Text style={styles.stepCount}>{quantity}</Text>
      <Tap onPress={() => onChange(quantity + 1)} disabled={quantity >= max} scaleTo={0.85} hitSlop={6} accessibilityRole="button"
        accessibilityLabel={`One more ${label}`} style={[styles.stepButton, quantity >= max && styles.stepOff]}>
        <Text style={[styles.stepSign, { color: colors.white }]}>+</Text>
      </Tap>
    </View>
  );
}

export function ShopStatusBadge({ status }: { status: ShopOrderStatus }) {
  const colors = useColors();
  const styles = useStyles();
  const label = SHOP_ORDER_STATUSES.find(s => s.id === status)?.label ?? status;
  const tone = status === 'cancelled' ? colors.tones.red : status === 'delivered' ? colors.tones.green : status === 'placed' ? colors.tones.gray : colors.tones.blue;
  return (
    <View style={[styles.status, { backgroundColor: tone.background }]}>
      <View style={[styles.statusDot, { backgroundColor: tone.text }]} />
      <Text style={[styles.statusText, { color: tone.text }]}>{label}</Text>
    </View>
  );
}

/** The floating green bar at the bottom of the store while the cart has something in it. */
export function CartBar({ count, total, savings, onPress, bottom = 0 }: { count: number; total: number; savings: number; onPress: () => void; bottom?: number }) {
  const styles = useStyles();
  const d = useDesign();
  const insets = useSafeAreaInsets();
  if (!count) return null;
  return (
    <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOutDown.duration(200)} pointerEvents="box-none"
      style={[styles.cartWrap, { bottom: bottom + Math.max(insets.bottom, 12) }]}>
      <Tap onPress={onPress} scaleTo={0.97} accessibilityRole="button"
        accessibilityLabel={`View cart, ${count} item${count === 1 ? '' : 's'}, ${formatInr(total)}`}
        style={[styles.cartBar, { boxShadow: d.shadow.lg }]}>
        <View style={styles.cartIcon}>
          <Icon name="orders" color="#ffffff" size={22} />
        </View>
        <View style={styles.cartText}>
          <Text style={styles.cartTitle}>View cart</Text>
          <Text style={styles.cartSub}>
            {count} item{count === 1 ? '' : 's'} · {formatInr(total)}{savings > 0 ? ` · you save ${formatInr(savings)}` : ''}
          </Text>
        </View>
        <Icon name="chevronRight" color="#ffffff" size={20} strokeWidth={2.4} />
      </Tap>
    </Animated.View>
  );
}

const useStyles = makeStyles(colors => ({
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6 },
  price: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.4, color: colors.navy },
  priceLg: { fontSize: 22, lineHeight: 28 },
  mrp: { fontSize: 13, lineHeight: 18, color: colors.muted, textDecorationLine: 'line-through' },
  mrpLg: { fontSize: 15 },
  off: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.green },
  offLg: { fontSize: 15 },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.green, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, zIndex: 2 },
  badgeText: { fontSize: 12, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.greenTint, borderRadius: radii.pill, padding: 3, gap: 4, alignSelf: 'stretch', justifyContent: 'space-between' },
  stepButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green },
  stepOff: { opacity: 0.4 },
  stepSign: { fontSize: 18, lineHeight: 20, fontWeight: '700', color: '#ffffff' },
  stepCount: { ...type.label, fontSize: 15, color: colors.greenDark, minWidth: 18, textAlign: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...type.tiny, fontSize: 10.5, textTransform: 'uppercase' },
  cartWrap: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 16, alignItems: 'center' },
  cartBar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.green, borderRadius: radii.pill, paddingVertical: 10, paddingLeft: 10, paddingRight: 18, width: '100%', maxWidth: MAX_CONTENT },
  cartIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  cartText: { flex: 1, gap: 1 },
  cartTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.4, color: '#ffffff' },
  cartSub: { ...type.small, fontSize: 12, color: 'rgba(255,255,255,0.88)' },
}));
