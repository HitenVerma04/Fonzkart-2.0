import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBrands, useSession } from '@fonzkart/api';
import { SELL_CATEGORIES } from '@fonzkart/core';
import { ErrorState, Loading, Logo, RemoteImage, SearchField, Tile, colors, font, radius, spacing } from '@fonzkart/ui';
import { CATEGORY_IMAGES } from '../src/categoryImages';
import { GRID_GAP, PAGE_PADDING, useTileWidth } from '../src/grid';

const TOP_BRANDS = 8;
const CARD_RATIO = 2000 / 1600; // category card pictures are 4:5 portrait

export default function Home() {
  const router = useRouter();
  const categoryWidth = useTileWidth(3);
  const brandWidth = useTileWidth(4);
  const brands = useBrands('smartphone');
  const { session } = useSession();
  const accountLabel = session.status === 'signedIn' ? session.user.name.trim().split(/\s+/)[0] || 'Account' : 'Sign in';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Logo variant="horizontal" height={44} />
          <Pressable
            onPress={() => router.push('/account')}
            accessibilityRole="button"
            accessibilityLabel="Account"
            style={({ pressed }) => [styles.account, pressed && styles.pressed]}
          >
            <Text style={styles.accountText} numberOfLines={1}>{accountLabel}</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>Sell your old device</Text>
        <Pressable onPress={() => router.push('/search')} accessibilityRole="search">
          <View pointerEvents="none">
            <SearchField placeholder="Search your phone, e.g. iPhone 14" editable={false} />
          </View>
        </Pressable>

        <Text style={styles.section}>Choose a category</Text>
        <View style={styles.grid}>
          {SELL_CATEGORIES.map(category => (
            // The card pictures carry their own title, so no label is drawn under them.
            <Pressable
              key={category.id}
              onPress={() => router.push({ pathname: '/category/[id]', params: { id: category.id } })}
              accessibilityRole="button"
              accessibilityLabel={category.name}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Image source={CATEGORY_IMAGES[category.id]} style={{ width: categoryWidth, height: categoryWidth * CARD_RATIO }} resizeMode="contain" />
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Top phone brands</Text>
        {brands.isPending ? (
          <Loading />
        ) : brands.isError ? (
          <ErrorState onRetry={() => brands.refetch()} />
        ) : (
          <View style={styles.grid}>
            {brands.data.slice(0, TOP_BRANDS).map(brand => (
              <Tile
                key={brand.id}
                label={brand.name}
                width={brandWidth}
                onPress={() => router.push({ pathname: '/brand/[id]', params: { id: brand.id, category: 'smartphone', name: brand.name } })}
                image={<RemoteImage uri={brand.logo} label={brand.name} size={brandWidth - 28} />}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  account: { maxWidth: 120, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  accountText: { fontSize: font.small, fontWeight: '700', color: colors.navy },
  title: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  section: { fontSize: font.heading, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  pressed: { opacity: 0.7 },
});
