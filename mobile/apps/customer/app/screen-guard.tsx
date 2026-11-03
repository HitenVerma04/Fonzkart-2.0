// The screen guard store: a guard for every phone in the catalog. Pick the brand (preselected when it is the one in
// your hand), search the exact model, add guards to the cart. Prices show the sale price with the struck-through MRP
// and the saving when the discount switch (Admin app) is on. The cart bar at the bottom leads to checkout. The grid is
// virtualised, as the store lists about a thousand models.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { cancelAnimation, Easing, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { discountPercent, GUARD_TYPES, useScreenGuardStore, type GuardType, type ScreenGuard } from '@fonzkart/api';
import { makeStyles, useColors } from '@fonzkart/ui';
import {
  Appear, Button, Chip, EmptyState, ErrorState, Icon, MAX_CONTENT, PAGE_PADDING, radii, SearchBar, SkeletonTiles, type,
  useDesign,
} from '../src/design';
import { GRID_GAP, useTileWidth } from '../src/grid';
import { readDeviceSpecs } from '../src/home/thisDevice';
import { MAX_QUANTITY, priceCart, pruneCart, setQuantity, useCart } from '../src/shop/cart';
import { GuardShowcase } from '../src/shop/GuardShowcase';
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
  const [query, setQuery] = useState('');
  const [guardType, setGuardType] = useState<GuardType | null>(null);
  const preselected = useRef(false);

  // One clock for every card, stopped while another screen covers this one.
  const clock = useSharedValue(0);
  useFocusEffect(useCallback(() => {
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration: 5600, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [clock]));

  const items = useMemo(() => store.data?.items ?? [], [store.data]);
  const brands = useMemo(() => [...new Set(items.map(i => i.brand))], [items]);

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
    const fit = items.find(i => i.brand === mine.brand && names.some(n => normal(i.model) === n || n.endsWith(normal(i.model)) || normal(i.model).endsWith(n)));
    if (fit) setQuery(fit.model);
  }, [store.data, items]);

  const words = normal(query);
  const shown = useMemo(() => items.filter(i => (!brand || i.brand === brand) && (!words || normal(i.model).includes(words))), [items, brand, words]);
  const typesHere = GUARD_TYPES.filter(t => shown.some(i => i.guardType === t.id));
  const visible = useMemo(() => shown.filter(i => !guardType || i.guardType === guardType), [shown, guardType]);
  const totals = priceCart(cart, items);
  const quantities = useMemo(() => new Map(cart.map(l => [l.screenGuardId, l.quantity])), [cart]);
  const showDiscount = !!store.data?.discountsEnabled;
  const ready = !!store.data?.storeEnabled && items.length > 0;

  const renderItem = useCallback(({ item, index }: { item: ScreenGuard; index: number }) => (
    <GuardCard item={item} width={width} index={index} showDiscount={showDiscount} quantity={quantities.get(item.id) ?? 0} clock={clock} />
  ), [width, showDiscount, quantities, clock]);

  const header = (
    <View style={styles.header}>
      <Appear style={[styles.hero, { backgroundImage: d.heroGradient }]}>
        <View style={styles.heroIcon}>
          <Icon name="shield" color="#ffffff" size={30} filled />
        </View>
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
      {ready ? (
        <>
          <Appear index={1} style={[styles.finder, { boxShadow: d.shadow.sm }]}>
            <View style={styles.finderHead}>
              <Icon name="search" color={colors.green} size={18} />
              <Text style={styles.finderTitle}>Find your guard</Text>
            </View>
            <Text style={styles.step}>1. Your phone's brand</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="All brands" selected={!brand} onPress={() => setBrand(null)} />
              {brands.map(b => <Chip key={b} label={b} selected={brand === b} onPress={() => setBrand(b)} />)}
            </ScrollView>
            <Text style={styles.step}>2. Your exact model</Text>
            <SearchBar value={query} onChangeText={setQuery} placeholder={`Search ${items.length} models`} />
          </Appear>
          {typesHere.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="All types" selected={!guardType} onPress={() => setGuardType(null)} />
              {typesHere.map(t => <Chip key={t.id} label={t.label} selected={guardType === t.id} onPress={() => setGuardType(t.id)} />)}
            </ScrollView>
          ) : null}
        </>
      ) : null}
    </View>
  );

  const empty = () => {
    if (store.isPending) return <SkeletonTiles count={4} width={width} imageHeight={width - 40} kind="phone" />;
    if (store.isError) return <ErrorState error={store.error} onRetry={() => store.refetch()} />;
    if (!ready) {
      return (
        <EmptyState icon="shield" title="Screen guards are coming soon" message="Tempered glass, privacy and matte guards for your exact model, delivered to your door."
          action={{ label: 'Sell a device', onPress: () => router.navigate('/') }} />
      );
    }
    return (
      <EmptyState icon="shield" title="No guards for this model yet" message="Try another model, or see every guard we have."
        action={{ label: 'Show all guards', onPress: () => { setBrand(null); setQuery(''); setGuardType(null); } }} />
    );
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={ready ? visible : []}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={header}
        ListEmptyComponent={empty()}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.page, { paddingBottom: totals.count ? 120 : 40 }]}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
      />
      <CartBar count={totals.count} total={totals.payTotal} savings={totals.savings} onPress={() => router.push('/shop/cart')} />
    </View>
  );
}

const GuardCard = memo(function GuardCard({ item, width, index, showDiscount, quantity, clock }: {
  item: ScreenGuard;
  width: number;
  index: number;
  showDiscount: boolean;
  quantity: number;
  clock: SharedValue<number>;
}) {
  const styles = useStyles();
  const d = useDesign();
  const card = [styles.card, { width, boxShadow: d.shadow.sm }];
  const content = (
    <>
      {showDiscount ? <DiscountBadge percent={discountPercent(item.mrp, item.price)} /> : null}
      <View style={styles.well}>
        <GuardShowcase model={item.model} size={width - 22} clock={clock} />
      </View>
      <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
      <PriceBlock price={item.price} mrp={item.mrp} />
      <View style={styles.action}>
        {quantity ? (
          <Stepper quantity={quantity} max={MAX_QUANTITY} onChange={q => setQuantity(item.id, q)} label={item.name} />
        ) : (
          <Button title="Add" variant="secondary" size="sm" icon="orders" onPress={() => setQuantity(item.id, 1)} />
        )}
      </View>
    </>
  );
  // Only the first cards rise in: cards further down mount during scrolling, where that would look like jitter.
  return index < 6 ? <Appear index={index} style={card}>{content}</Appear> : <View style={card}>{content}</View>;
});

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { padding: PAGE_PADDING, gap: GRID_GAP, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  header: { gap: 16, marginBottom: 4 },
  hero: { borderRadius: radii.xl, padding: 20, gap: 4, overflow: 'hidden' },
  heroIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  heroTitle: { ...type.title, fontSize: 28, lineHeight: 34, color: '#ffffff' },
  promises: { gap: 6, marginTop: 10 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promiseText: { ...type.small, fontWeight: '600', color: '#ffffff' },
  finder: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  finderHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  finderTitle: { ...type.heading, fontSize: 17, color: colors.navy },
  step: { ...type.small, fontWeight: '600', color: colors.muted },
  chips: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  row: { gap: GRID_GAP },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 4 },
  well: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, borderRadius: radii.md, paddingVertical: 4, marginBottom: 6 },
  name: { ...type.label, fontSize: 14, lineHeight: 18, color: colors.navy, minHeight: 36 },
  action: { marginTop: 8 },
}));
