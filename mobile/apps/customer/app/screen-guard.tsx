// The screen guard store: pick the phone (preselected when it is the one in your hand), filter by guard type, add
// guards to the cart. Prices show the sale price with the struck-through MRP and the saving when the discount switch
// (Admin app) is on. The cart bar at the bottom leads to checkout.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { discountPercent, GUARD_TYPES, useScreenGuardStore, type GuardType, type ScreenGuard } from '@fonzkart/api';
import { makeStyles, useColors } from '@fonzkart/ui';
import {
  Appear, Button, Chip, EmptyState, ErrorState, Icon, MAX_CONTENT, PAGE_PADDING, ProductImage, radii, SkeletonTiles, type,
  useDesign,
} from '../src/design';
import { GRID_GAP, useTileWidth } from '../src/grid';
import { readDeviceSpecs } from '../src/home/thisDevice';
import { MAX_QUANTITY, priceCart, pruneCart, setQuantity, useCart } from '../src/shop/cart';
import { CartBar, DiscountBadge, PriceBlock, Stepper } from '../src/shop/ShopBits';

const PROMISES = ['Confirmed fit for your exact model', 'Cash on delivery', 'Installation guide included'];
const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export default function ScreenGuardStore() {
  const styles = useStyles();
  const d = useDesign();
  const colors = useColors();
  const router = useRouter();
  const store = useScreenGuardStore();
  const cart = useCart();
  const width = useTileWidth(2);
  const [brand, setBrand] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [guardType, setGuardType] = useState<GuardType | null>(null);
  const preselected = useRef(false);

  const items = useMemo(() => store.data?.items ?? [], [store.data]);
  const brands = useMemo(() => [...new Set(items.map(i => i.brand))].sort(), [items]);
  const models = useMemo(() => [...new Set(items.filter(i => i.brand === brand).map(i => i.model))].sort(), [items, brand]);

  // Drop guards no longer sold from the cart, and preselect the phone in the customer's hand when it is sold here.
  useEffect(() => {
    if (!store.data?.storeEnabled) return;
    pruneCart(new Set(items.map(i => i.id)));
    if (preselected.current || !items.length) return;
    preselected.current = true;
    const specs = readDeviceSpecs();
    if (!specs) return;
    const maker = normal(specs.maker);
    const mine = items.find(i => maker && (normal(i.brand).startsWith(maker) || maker.startsWith(normal(i.brand))));
    if (!mine) return;
    setBrand(mine.brand);
    const names = [specs.deviceName, specs.modelName].map(normal).filter(Boolean);
    const fit = items.find(i => i.brand === mine.brand && names.some(n => normal(i.model) === n || n.endsWith(normal(i.model))));
    if (fit) setModel(fit.model);
  }, [store.data, items]);

  const shown = items.filter(i => (!brand || i.brand === brand) && (!model || i.model === model));
  const typesHere = GUARD_TYPES.filter(t => shown.some(i => i.guardType === t.id));
  const visible = shown.filter(i => !guardType || i.guardType === guardType);
  const totals = priceCart(cart, items);
  const quantityOf = (id: string) => cart.find(l => l.screenGuardId === id)?.quantity ?? 0;

  const body = () => {
    if (store.isPending) return <SkeletonTiles count={4} width={width} imageHeight={width - 40} kind="phone" />;
    if (store.isError) return <ErrorState error={store.error} onRetry={() => store.refetch()} />;
    if (!store.data.storeEnabled || !items.length) {
      return (
        <EmptyState icon="shield" title="Screen guards are coming soon" message="Tempered glass, privacy and matte guards for your exact model, delivered to your door."
          action={{ label: 'Sell a device', onPress: () => router.navigate('/') }} />
      );
    }
    return (
      <>
        <Appear index={1} style={[styles.finder, { boxShadow: d.shadow.sm }]}>
          <View style={styles.finderHead}>
            <Icon name="search" color={colors.green} size={18} />
            <Text style={styles.finderTitle}>Find your guard</Text>
          </View>
          <Text style={styles.step}>1. Your phone's brand</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="All brands" selected={!brand} onPress={() => { setBrand(null); setModel(null); }} />
            {brands.map(b => <Chip key={b} label={b} selected={brand === b} onPress={() => { setBrand(b); setModel(null); }} />)}
          </ScrollView>
          {brand ? (
            <>
              <Text style={styles.step}>2. Your exact model</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label={`All ${brand}`} selected={!model} onPress={() => setModel(null)} />
                {models.map(m => <Chip key={m} label={m} selected={model === m} onPress={() => setModel(m)} />)}
              </ScrollView>
            </>
          ) : null}
        </Appear>

        {typesHere.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="All types" selected={!guardType} onPress={() => setGuardType(null)} />
            {typesHere.map(t => <Chip key={t.id} label={t.label} selected={guardType === t.id} onPress={() => setGuardType(t.id)} />)}
          </ScrollView>
        ) : null}

        {visible.length ? (
          <View style={styles.grid}>
            {visible.map((item, i) => (
              <GuardCard key={item.id} item={item} width={width} index={i} showDiscount={store.data.discountsEnabled}
                quantity={quantityOf(item.id)} onQuantity={q => setQuantity(item.id, q)} />
            ))}
          </View>
        ) : (
          <EmptyState icon="shield" title="No guards for this model yet" message="Try another model, or see every guard we have."
            action={{ label: 'Show all guards', onPress: () => { setBrand(null); setModel(null); setGuardType(null); } }} />
        )}
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.page, { paddingBottom: totals.count ? 120 : 40 }]}>
        <Appear style={[styles.hero, { backgroundImage: d.heroGradient }]}>
          <View style={styles.heroIcon}>
            <Icon name="shield" color="#ffffff" size={30} filled />
          </View>
          <Text style={styles.heroKicker}>FonzCare</Text>
          <Text style={styles.heroTitle}>Screen guards</Text>
          <View style={styles.promises}>
            {PROMISES.map(p => (
              <View key={p} style={styles.promise}>
                <Icon name="check" color="#bbf7d0" size={15} strokeWidth={2.6} />
                <Text style={styles.promiseText}>{p}</Text>
              </View>
            ))}
          </View>
        </Appear>
        {body()}
      </ScrollView>
      <CartBar count={totals.count} total={totals.payTotal} savings={totals.savings} onPress={() => router.push('/shop/cart')} />
    </View>
  );
}

function GuardCard({ item, width, index, showDiscount, quantity, onQuantity }: {
  item: ScreenGuard;
  width: number;
  index: number;
  showDiscount: boolean;
  quantity: number;
  onQuantity: (quantity: number) => void;
}) {
  const styles = useStyles();
  const d = useDesign();
  const typeLabel = GUARD_TYPES.find(t => t.id === item.guardType)?.label ?? item.guardType;
  return (
    <Appear index={Math.min(index, 6)} style={[styles.card, { width, boxShadow: d.shadow.sm }]}>
      {showDiscount ? <DiscountBadge percent={discountPercent(item.mrp, item.price)} /> : null}
      <View style={styles.well}>
        <ProductImage uri={item.imageUrl} label={item.name} size={width - 40} kind="phone" />
      </View>
      <Text style={styles.typeLabel}>{typeLabel}</Text>
      <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.model} numberOfLines={1}>For {item.model.startsWith(item.brand) ? item.model : `${item.brand} ${item.model}`}</Text>
      <PriceBlock price={item.price} mrp={item.mrp} />
      <View style={styles.action}>
        {quantity ? (
          <Stepper quantity={quantity} max={MAX_QUANTITY} onChange={onQuantity} label={item.name} />
        ) : (
          <Button title="Add" variant="secondary" size="sm" icon="orders" onPress={() => onQuantity(1)} />
        )}
      </View>
    </Appear>
  );
}

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { padding: PAGE_PADDING, gap: 16, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  hero: { borderRadius: radii.xl, padding: 20, gap: 4, overflow: 'hidden' },
  heroIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  heroKicker: { ...type.tiny, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' },
  heroTitle: { ...type.title, fontSize: 28, lineHeight: 34, color: '#ffffff' },
  promises: { gap: 6, marginTop: 10 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promiseText: { ...type.small, fontWeight: '600', color: '#ffffff' },
  finder: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  finderHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  finderTitle: { ...type.heading, fontSize: 17, color: colors.navy },
  step: { ...type.small, fontWeight: '600', color: colors.muted },
  chips: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 4 },
  well: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, borderRadius: radii.md, paddingVertical: 10, marginBottom: 6 },
  typeLabel: { ...type.tiny, fontSize: 10, textTransform: 'uppercase', color: colors.green },
  name: { ...type.label, fontSize: 14, lineHeight: 18, color: colors.navy, minHeight: 36 },
  model: { ...type.small, fontSize: 12, color: colors.muted },
  action: { marginTop: 8 },
}));
