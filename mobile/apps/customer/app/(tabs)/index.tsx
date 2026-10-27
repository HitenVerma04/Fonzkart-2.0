import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBrands, useSession } from '@fonzkart/api';
import { SELL_CATEGORIES } from '@fonzkart/core';
import { ErrorState, font, Loading, Logo, makeStyles, radius, RemoteImage, SearchField, spacing, Tile } from '@fonzkart/ui';
import { CategoryCard } from '../../src/categoryArt/CategoryCard';
import { HomeCarousel } from '../../src/HomeCarousel';
import { GRID_GAP, PAGE_PADDING, useTileWidth } from '../../src/grid';

const TOP_BRANDS = 8;

export default function Home() {
  const styles = useStyles();
  const router = useRouter();
  const categoryWidth = useTileWidth(3);
  const carouselWidth = useTileWidth(1);
  const brandWidth = useTileWidth(4);
  const brands = useBrands('smartphone');
  const { session } = useSession();
  const accountLabel = session.status === 'signedIn' ? session.user.name.trim().split(/\s+/)[0] || 'Account' : 'Sign in';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Logo variant="horizontal" height={44} />
          <View style={styles.headerActions}>
            {session.status === 'signedIn' ? (
              <Pressable
                onPress={() => router.push('/orders')}
                accessibilityRole="button"
                accessibilityLabel="My orders"
                style={({ pressed }) => [styles.account, pressed && styles.pressed]}
              >
                <Text style={styles.accountText}>Orders</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.navigate('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Profile"
              style={({ pressed }) => [styles.account, pressed && styles.pressed]}
            >
              <Text style={styles.accountText} numberOfLines={1}>{accountLabel}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.title}>Turn your old devices into <Text style={styles.highlight}>cash</Text></Text>
        <Pressable onPress={() => router.push('/search')} accessibilityRole="search">
          <View pointerEvents="none">
            <SearchField placeholder="Search your phone, e.g. iPhone 14" editable={false} />
          </View>
        </Pressable>

        <HomeCarousel width={carouselWidth} />

        <Text style={styles.section}>Choose a category</Text>
        <View style={styles.grid}>
          {SELL_CATEGORIES.map((category, index) => (
            <CategoryCard
              key={category.id}
              id={category.id}
              name={category.name}
              width={categoryWidth}
              index={index}
              onPress={() => router.push({ pathname: '/category/[id]', params: { id: category.id } })}
            />
          ))}
          {/* The website's other cards, after the sell categories as there. */}
          <CategoryCard id="repair" name="Repair" width={categoryWidth} index={SELL_CATEGORIES.length}
            onPress={() => router.navigate('/repair')} />
          <CategoryCard id="screenguard" name="Screen Guard" width={categoryWidth} index={SELL_CATEGORIES.length + 1}
            onPress={() => router.push('/screen-guard')} />
          <CategoryCard id="bulk" name="Bulk Orders" width={categoryWidth} index={SELL_CATEGORIES.length + 2}
            onPress={() => router.push('/bulk')} />
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

const useStyles = makeStyles(colors => ({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  account: { maxWidth: 120, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  accountText: { fontSize: font.small, fontWeight: '700', color: colors.navy },
  title: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  highlight: { color: colors.green },
  section: { fontSize: font.heading, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  pressed: { opacity: 0.7 },
}));
