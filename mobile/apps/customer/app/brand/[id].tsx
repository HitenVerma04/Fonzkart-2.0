import { useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useBrand, useModels } from '@fonzkart/api';
import { makeStyles } from '@fonzkart/ui';
import { groupSeries, modelImage } from '@fonzkart/core';
import { deviceKindOf, EmptyState, ErrorState, MAX_CONTENT, PAGE_PADDING, ProductImage, SearchBar, SkeletonTiles, Tile } from '../../src/design';
import { GRID_GAP, useTileWidth } from '../../src/grid';
import { recordSellStep } from '../../src/sellProgress';
import { SeriesPicker, useSeriesPanel } from '../../src/SeriesPicker';

const COLUMNS = 2;
/** Below this many models a series picker only gets in the way. */
const SERIES_FROM = 6;

export default function BrandModels() {
  const styles = useStyles();
  const { id, category, name } = useLocalSearchParams<{ id: string; category?: string; name?: string }>();
  const router = useRouter();
  const width = useTileWidth(COLUMNS);
  const [filter, setFilter] = useState('');
  const [seriesKey, setSeriesKey] = useState<string | null>(null);
  const [seriesOpen, setSeriesOpen] = useSeriesPanel();
  const brand = useBrand(name ? undefined : id); // the name normally comes with the link
  const models = useModels(id, category);
  const brandName = name ?? brand.data?.name ?? 'Models';
  const knownName = name ?? brand.data?.name;

  // Saved for "Pick up where you left off" on Home.
  useEffect(() => {
    recordSellStep({ stage: 'models', category: category ?? 'smartphone', brandId: id, brandName: knownName });
  }, [id, category, knownName]);

  // The brand's series (Realme 2 Series, Realme C Series, …), from the model names.
  const series = useMemo(() => {
    const list = models.data ?? [];
    // Phones only: watch and tablet names ("Watch Series 9", "Tab S9") do not group well this way.
    return (category ?? 'smartphone') === 'smartphone' && list.length >= SERIES_FROM ? groupSeries(knownName ?? '', list) : [];
  }, [models.data, knownName, category]);

  const shown = useMemo(() => {
    const words = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const inSeries = seriesKey ? new Set(series.find(s => s.key === seriesKey)?.modelIds ?? []) : null;
    const list = (models.data ?? []).filter(m => !inSeries || inSeries.has(m.id));
    return words.length ? list.filter(m => words.every(w => m.name.toLowerCase().includes(w))) : list;
  }, [models.data, filter, series, seriesKey]);

  return (
    <>
      <Stack.Screen options={{ title: brandName }} />
      {models.isPending ? (
        <View style={styles.page}>
          <SkeletonTiles count={6} width={width} imageHeight={width - 56} kind={deviceKindOf(category)} />
        </View>
      ) : models.isError ? (
        <ErrorState error={models.error} onRetry={() => models.refetch()} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={m => m.id}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.page}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.filter}>
              <SearchBar value={filter} onChangeText={setFilter} placeholder={`Search ${brandName} models`} />
              {series.length ? (
                <SeriesPicker series={series} selected={seriesKey} onSelect={setSeriesKey}
                  open={seriesOpen} onToggle={() => setSeriesOpen(!seriesOpen)} />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="search" message={filter ? 'No model matches your search.' : 'No models listed for this brand yet.'} />
          }
          renderItem={({ item }) => {
            const img = modelImage(item.img, category ?? item.category);
            return (
              <Tile
                label={item.name}
                width={width}
                onPress={() => router.push({ pathname: '/model/[id]', params: { id: item.id, name: item.name, img: img ?? '', category: category ?? item.category } })}
                image={<ProductImage uri={img} label={item.name} size={width - 56} kind={deviceKindOf(category ?? item.category)} />}
              />
            );
          }}
        />
      )}
    </>
  );
}

const useStyles = makeStyles(colors => ({
  list: { backgroundColor: colors.background },
  page: { padding: PAGE_PADDING, paddingTop: 4, paddingBottom: 32, gap: GRID_GAP, maxWidth: MAX_CONTENT, width: '100%', alignSelf: 'center' },
  row: { gap: GRID_GAP },
  filter: { marginBottom: 4, gap: 14 },
}));
