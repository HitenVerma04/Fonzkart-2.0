import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useBrand, useModels } from '@fonzkart/api';
import { makeStyles } from '@fonzkart/ui';
import { modelImage } from '@fonzkart/core';
import { EmptyState, ErrorState, MAX_CONTENT, PAGE_PADDING, ProductImage, SearchBar, SkeletonTiles, Tile } from '../../src/design';
import { GRID_GAP, useTileWidth } from '../../src/grid';

const COLUMNS = 2;

export default function BrandModels() {
  const styles = useStyles();
  const { id, category, name } = useLocalSearchParams<{ id: string; category?: string; name?: string }>();
  const router = useRouter();
  const width = useTileWidth(COLUMNS);
  const [filter, setFilter] = useState('');
  const brand = useBrand(name ? undefined : id); // the name normally comes with the link
  const models = useModels(id, category);
  const brandName = name ?? brand.data?.name ?? 'Models';

  const shown = useMemo(() => {
    const words = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = models.data ?? [];
    return words.length ? list.filter(m => words.every(w => m.name.toLowerCase().includes(w))) : list;
  }, [models.data, filter]);

  return (
    <>
      <Stack.Screen options={{ title: brandName }} />
      {models.isPending ? (
        <View style={styles.page}>
          <SkeletonTiles count={6} width={width} imageHeight={width - 56} />
        </View>
      ) : models.isError ? (
        <ErrorState onRetry={() => models.refetch()} />
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
                image={<ProductImage uri={img} label={item.name} size={width - 56} />}
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
  filter: { marginBottom: 4 },
}));
