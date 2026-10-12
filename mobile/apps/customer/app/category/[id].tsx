import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useBrands } from '@fonzkart/api';
import { categoryName } from '@fonzkart/core';
import { EmptyState, ErrorState, Loading, RemoteImage, Tile, colors, font, spacing } from '@fonzkart/ui';
import { GRID_GAP, PAGE_PADDING, useTileWidth } from '../../src/grid';

export default function CategoryBrands() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const width = useTileWidth(3);
  const brands = useBrands(id);
  const title = categoryName(id) ?? 'Brands';

  return (
    <>
      <Stack.Screen options={{ title }} />
      {brands.isPending ? (
        <Loading />
      ) : brands.isError ? (
        <ErrorState onRetry={() => brands.refetch()} />
      ) : brands.data.length === 0 ? (
        <EmptyState message="No brands in this category yet." />
      ) : (
        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.hint}>Select your brand</Text>
          <View style={styles.grid}>
            {brands.data.map(brand => (
              <Tile
                key={brand.id}
                label={brand.name}
                width={width}
                onPress={() => router.push({ pathname: '/brand/[id]', params: { id: brand.id, category: id, name: brand.name } })}
                image={<RemoteImage uri={brand.logo} label={brand.name} size={width - 36} />}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hint: { fontSize: font.body, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
});
