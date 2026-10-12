import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useBrand, useModels } from '@fonzkart/api';
import { EmptyState, ErrorState, Loading, RemoteImage, SearchField, Tile, spacing } from '@fonzkart/ui';
import { GRID_GAP, PAGE_PADDING, useTileWidth } from '../../src/grid';

const COLUMNS = 2;

export default function BrandModels() {
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
        <Loading />
      ) : models.isError ? (
        <ErrorState onRetry={() => models.refetch()} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={m => m.id}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.filter}>
              <SearchField value={filter} onChangeText={setFilter} placeholder={`Search ${brandName} models`} />
            </View>
          }
          ListEmptyComponent={<EmptyState message={filter ? 'No model matches your search.' : 'No models listed for this brand yet.'} />}
          renderItem={({ item }) => (
            <Tile
              label={item.name}
              width={width}
              onPress={() => router.push({ pathname: '/model/[id]', params: { id: item.id, name: item.name, img: item.img ?? '' } })}
              image={<RemoteImage uri={item.img} label={item.name} size={width - 48} />}
            />
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: GRID_GAP, maxWidth: 640, width: '100%', alignSelf: 'center' },
  row: { gap: GRID_GAP },
  filter: { marginBottom: spacing.xs },
});
