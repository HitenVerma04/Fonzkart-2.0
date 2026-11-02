import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useBrands } from '@fonzkart/api';
import { categoryName } from '@fonzkart/core';
import { makeStyles } from '@fonzkart/ui';
import { Appear, EmptyState, ErrorState, Page, ProductImage, SkeletonTiles, Tile, type } from '../../src/design';
import { GRID_GAP, useTileWidth } from '../../src/grid';

export default function CategoryBrands() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const width = useTileWidth(3);
  const brands = useBrands(id);
  const title = categoryName(id) ?? 'Brands';

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Page>
        <Appear>
          <Text style={styles.title}>Select your brand</Text>
          <Text style={styles.hint}>We'll show your device's best price next.</Text>
        </Appear>
        {brands.isPending ? (
          <SkeletonTiles count={9} width={width} imageHeight={width - 40} kind="logo" />
        ) : brands.isError ? (
          <ErrorState onRetry={() => brands.refetch()} />
        ) : brands.data.length === 0 ? (
          <EmptyState icon="box" title="No brands yet" message="No brands in this category yet." />
        ) : (
          <Appear index={1} style={styles.grid}>
            {brands.data.map(brand => (
              <Tile
                key={brand.id}
                label={brand.name}
                width={width}
                onPress={() => router.push({ pathname: '/brand/[id]', params: { id: brand.id, category: id, name: brand.name } })}
                image={<ProductImage uri={brand.logo} label={brand.name} size={width - 40} kind="logo" />}
              />
            ))}
          </Appear>
        )}
      </Page>
    </>
  );
}

const useStyles = makeStyles(colors => ({
  title: { ...type.title, color: colors.navy },
  hint: { ...type.body, color: colors.muted, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
}));
