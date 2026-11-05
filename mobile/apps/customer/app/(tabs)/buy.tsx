// Buy: refurbished devices. Pick the brand or search, narrow by condition, and tap a device to see it and buy it. Each
// listing is one kind of device with its own stock, so sold out devices simply leave the list.
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DEVICE_GRADES, useRefurbishedStore, type DeviceGrade, type RefurbishedDevice } from '@fonzkart/api';
import { makeStyles, useColors } from '@fonzkart/ui';
import {
  Appear, Chip, EmptyState, ErrorState, MAX_CONTENT, PAGE_PADDING, ProductImage, radii, SearchBar, SkeletonTiles, TabTitle, Tap,
  type, useDesign, useTabBarSpace,
} from '../../src/design';
import { GRID_GAP, useTileWidth } from '../../src/grid';
import { GradeBadge } from '../../src/shop/GradeBadge';
import { ServiceHero } from '../../src/shop/ServiceHero';
import { PriceBlock } from '../../src/shop/ShopBits';

const PROMISES = ['Checked and tested by Fonzkart', 'Honest condition grades', 'Cash on delivery'];
const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export default function Buy() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const bottom = useTabBarSpace();
  const store = useRefurbishedStore();
  const width = useTileWidth(2);
  const [brand, setBrand] = useState<string | null>(null);
  const [grade, setGrade] = useState<DeviceGrade | null>(null);
  const [query, setQuery] = useState('');

  const items = useMemo(() => store.data?.items ?? [], [store.data]);
  const brands = useMemo(() => [...new Set(items.map(i => i.brand))], [items]);
  const words = normal(query);
  const shown = useMemo(() => items.filter(i => (!brand || i.brand === brand) && (!grade || i.grade === grade)
    && (!words || normal(i.name).includes(words))), [items, brand, grade, words]);
  const ready = !!store.data?.enabled && items.length > 0;

  const renderItem = useCallback(({ item, index }: { item: RefurbishedDevice; index: number }) => (
    <DeviceCard item={item} width={width} index={index} onPress={() => router.push({ pathname: '/refurbished/[id]', params: { id: item.id } })} />
  ), [width, router]);

  const header = (
    <View style={styles.header}>
      <ServiceHero glyph="buy" title="Refurbished devices" promises={PROMISES} />
      {ready ? (
        <Appear index={1} style={styles.filters}>
          <SearchBar value={query} onChangeText={setQuery} placeholder={`Search ${items.length} devices`} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="All brands" selected={!brand} onPress={() => setBrand(null)} />
            {brands.map(b => <Chip key={b} label={b} selected={brand === b} onPress={() => setBrand(b)} />)}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Any condition" selected={!grade} onPress={() => setGrade(null)} />
            {DEVICE_GRADES.map(g => <Chip key={g.id} label={g.label} selected={grade === g.id} onPress={() => setGrade(g.id)} />)}
          </ScrollView>
        </Appear>
      ) : null}
    </View>
  );

  const empty = () => {
    if (store.isPending) return <SkeletonTiles count={4} width={width} imageHeight={width - 40} kind="phone" />;
    if (store.isError) return <ErrorState error={store.error} onRetry={() => store.refetch()} />;
    if (!ready) {
      return (
        <EmptyState icon="buy" title="New stock is on its way" message="Refurbished devices will be listed here soon."
          action={{ label: 'Sell a device', onPress: () => router.navigate('/') }} />
      );
    }
    return (
      <EmptyState icon="buy" title="Nothing matches" message="Try another brand or condition."
        action={{ label: 'Show all devices', onPress: () => { setBrand(null); setGrade(null); setQuery(''); } }} />
    );
  };

  return (
    <View style={styles.screen}>
      <TabTitle title="Buy" />
      <FlatList
        data={ready ? shown : []}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={header}
        ListEmptyComponent={empty()}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={store.isRefetching} onRefresh={() => void store.refetch()} colors={[colors.green]} tintColor={colors.green} />}
        contentContainerStyle={[styles.page, { paddingBottom: bottom + 16 }]}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
      />
    </View>
  );
}

const DeviceCard = memo(function DeviceCard({ item, width, index, onPress }: { item: RefurbishedDevice; width: number; index: number; onPress: () => void }) {
  const styles = useStyles();
  const d = useDesign();
  return (
    <Appear index={Math.min(index, 6)}>
      <Tap onPress={onPress} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.storage}`}
        style={[styles.card, { width, boxShadow: d.shadow.sm }]}>
        <View style={styles.well}>
          <ProductImage uri={item.imageUrl} label={item.name} size={width - 40} />
        </View>
        <GradeBadge grade={item.grade} />
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.storage} numberOfLines={1}>{item.storage}</Text>
        <PriceBlock price={item.price} mrp={item.mrp} />
        {item.stock <= 2 ? <Text style={styles.few}>Only {item.stock} left</Text> : null}
      </Tap>
    </Appear>
  );
});

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { padding: PAGE_PADDING, gap: GRID_GAP, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  header: { gap: 14, marginBottom: 4 },
  filters: { gap: 10 },
  chips: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  row: { gap: GRID_GAP },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 4 },
  well: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderRadius: radii.md, paddingVertical: 8, marginBottom: 4 },
  name: { ...type.label, fontSize: 14, lineHeight: 18, color: colors.navy, minHeight: 36, marginTop: 2 },
  storage: { ...type.small, fontSize: 12, color: colors.muted },
  few: { ...type.small, fontSize: 12, fontWeight: '700', color: colors.warning.text },
}));
