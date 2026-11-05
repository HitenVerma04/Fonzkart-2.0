// Repair: find your phone (the one in your hand comes first when we repair it), then choose the repair and a visit.
// Prices are fixed per phone and repair, so the list shows what the cheapest repair starts from.
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useRepairPrices } from '@fonzkart/api';
import { formatInr } from '@fonzkart/core';
import { makeStyles, useColors } from '@fonzkart/ui';
import {
  Appear, Chip, EmptyState, ErrorState, Icon, MAX_CONTENT, PAGE_PADDING, radii, SearchBar, SkeletonRows, TabTitle, Tap, type, useDesign,
  useTabBarSpace,
} from '../../src/design';
import { readDeviceSpecs } from '../../src/home/thisDevice';
import { ServiceHero } from '../../src/shop/ServiceHero';

const PROMISES = ['Fixed price, shown before you book', 'Repaired at your doorstep', 'Pay after the repair'];
const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

type Phone = { brand: string; model: string; from: number; repairs: number };

export default function Repair() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const bottom = useTabBarSpace();
  const prices = useRepairPrices();
  const [brand, setBrand] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const phones = useMemo(() => {
    const found = new Map<string, Phone>();
    for (const p of prices.data?.items ?? []) {
      const key = `${p.brand}|${p.model}`;
      const phone = found.get(key);
      if (phone) {
        phone.from = Math.min(phone.from, p.price);
        phone.repairs += 1;
      } else found.set(key, { brand: p.brand, model: p.model, from: p.price, repairs: 1 });
    }
    return [...found.values()];
  }, [prices.data]);
  const brands = useMemo(() => [...new Set(phones.map(p => p.brand))], [phones]);

  // The phone in the customer's hand, when we repair it.
  const mine = useMemo(() => {
    const specs = readDeviceSpecs();
    if (!specs) return undefined;
    const names = [specs.deviceName, specs.modelName].map(normal).filter(Boolean);
    return phones.find(p => names.some(n => normal(p.model) === n || n.endsWith(normal(p.model))));
  }, [phones]);

  const words = normal(query);
  const shown = useMemo(() => phones.filter(p => (!brand || p.brand === brand) && (!words || normal(p.model).includes(words))), [phones, brand, words]);
  const ready = !!prices.data?.enabled && phones.length > 0;
  const open = useCallback((p: Phone) => router.push({ pathname: '/repairs/book', params: { brand: p.brand, model: p.model } }), [router]);

  const renderItem = useCallback(({ item, index }: { item: Phone; index: number }) => (
    <PhoneRow phone={item} index={index} onPress={() => open(item)} />
  ), [open]);

  const header = (
    <View style={styles.header}>
      <ServiceHero glyph="repair" title="Phone repair at home" promises={PROMISES} />
      {ready ? (
        <Appear index={1} style={styles.filters}>
          {mine ? <PhoneRow phone={mine} index={0} mine onPress={() => open(mine)} /> : null}
          <SearchBar value={query} onChangeText={setQuery} placeholder={`Search ${phones.length} phones`} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="All brands" selected={!brand} onPress={() => setBrand(null)} />
            {brands.map(b => <Chip key={b} label={b} selected={brand === b} onPress={() => setBrand(b)} />)}
          </ScrollView>
        </Appear>
      ) : null}
    </View>
  );

  const empty = () => {
    if (prices.isPending) return <SkeletonRows count={5} />;
    if (prices.isError) return <ErrorState error={prices.error} onRetry={() => prices.refetch()} />;
    if (!ready) {
      return (
        <EmptyState icon="repair" title="Repairs are starting soon" message="Book a doorstep phone repair here soon."
          action={{ label: 'Sell a device', onPress: () => router.navigate('/') }} />
      );
    }
    return (
      <EmptyState icon="repair" title="We don't repair this phone yet" message="Try another model, or see every phone we repair."
        action={{ label: 'Show all phones', onPress: () => { setBrand(null); setQuery(''); } }} />
    );
  };

  return (
    <View style={styles.screen}>
      <TabTitle title="Repair" />
      <FlatList
        data={ready ? shown : []}
        keyExtractor={p => `${p.brand}|${p.model}`}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty()}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={prices.isRefetching} onRefresh={() => void prices.refetch()} colors={[colors.green]} tintColor={colors.green} />}
        contentContainerStyle={[styles.page, { paddingBottom: bottom + 16 }]}
        initialNumToRender={10}
        windowSize={5}
      />
    </View>
  );
}

const PhoneRow = memo(function PhoneRow({ phone, index, mine, onPress }: { phone: Phone; index: number; mine?: boolean; onPress: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  const d = useDesign();
  const row = (
    <Tap onPress={onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${phone.model}, repairs from ${formatInr(phone.from)}`}
      style={[styles.row, mine && styles.mine, { boxShadow: d.shadow.sm }]}>
      <View style={styles.icon}><Icon name="repair" color={colors.green} size={20} filled /></View>
      <View style={styles.text}>
        {mine ? <Text style={styles.kicker}>Your phone</Text> : null}
        <Text style={styles.model} numberOfLines={1}>{phone.model}</Text>
        <Text style={styles.meta}>{phone.repairs} repair{phone.repairs === 1 ? '' : 's'} · from {formatInr(phone.from)}</Text>
      </View>
      <Icon name="chevronRight" color={colors.muted} size={18} />
    </Tap>
  );
  // Only the first rows rise in: rows further down mount during scrolling, where that would look like jitter.
  return index < 6 && !mine ? <Appear index={index}>{row}</Appear> : row;
});

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { padding: PAGE_PADDING, gap: 10, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  header: { gap: 14, marginBottom: 4 },
  filters: { gap: 10 },
  chips: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 12 },
  mine: { borderColor: colors.green },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenTint },
  text: { flex: 1, gap: 1 },
  kicker: { ...type.tiny, fontSize: 10.5, textTransform: 'uppercase', color: colors.green },
  model: { ...type.label, fontSize: 15, color: colors.navy },
  meta: { ...type.small, fontSize: 12, color: colors.muted },
}));
