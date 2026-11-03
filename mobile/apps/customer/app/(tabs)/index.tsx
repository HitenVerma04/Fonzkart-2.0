// Home, laid out like Blinkit's: a green header with the promise in big type, the search bar and a row of category
// tabs; then the carousel, "Sell this phone" (Cashify's), the animated sell categories, repair & protect, top phone
// brands, and the Fonzkart promise in a dark card (CRED's style).
import { useCallback } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import Animated, { runOnUI, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useBrands, useNotifications, useSession } from '@fonzkart/api';
import { SELL_CATEGORIES } from '@fonzkart/core';
import { Logo, makeStyles } from '@fonzkart/ui';
import { CategoryCard } from '../../src/categoryArt/CategoryCard';
import { ArtActivity, MotionActivity } from '../../src/categoryArt/motion';
import {
  Appear, ErrorState, Icon, IconButton, MAX_CONTENT, ProductImage, radii, SearchBar, SectionHeader, SkeletonTiles, Tile, type,
  useDesign, useTabBarSpace,
} from '../../src/design';
import { HomeCarousel } from '../../src/HomeCarousel';
import { PromiseCard, ServiceTiles } from '../../src/home/sections';
import { SellThisDevice } from '../../src/home/SellThisDevice';
import { GRID_GAP, PAGE_PADDING, useTileWidth } from '../../src/grid';

const TOP_BRANDS = 8;
const SUGGESTIONS = ['iPhone 13', 'Galaxy S23', 'OnePlus 11', 'iPad Air', 'MacBook Air', 'Apple Watch'];

export default function Home() {
  const styles = useStyles();
  const d = useDesign();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const categoryWidth = useTileWidth(3);
  const carouselWidth = useTileWidth(1);
  const brandWidth = useTileWidth(4);
  const serviceWidth = useTileWidth(4);
  const brands = useBrands('smartphone');
  const { session } = useSession();
  const signedIn = session.status === 'signedIn';
  const inbox = useNotifications(signedIn);
  const unread = inbox.data?.some(n => !n.isRead) ?? false;
  const firstName = signedIn ? session.user.name.trim().split(/\s+/)[0] : '';

  // Every category card animates all the time (the drawings are drawn by Skia on the GPU, see categoryArt/skiaSvg),
  // including while the list scrolls. They pause only when no one can see them: while another screen covers this one,
  // or when the cards are scrolled completely off screen.
  const { height: viewport } = useWindowDimensions();
  const artActive = useSharedValue(true);
  const focused = useSharedValue(true);
  const scrollY = useSharedValue(0);
  const bodyTop = useSharedValue(0);
  const cardsTop = useSharedValue(0);
  const cardsBottom = useSharedValue(Number.MAX_SAFE_INTEGER);
  const settle = () => {
    'worklet';
    const top = bodyTop.value + cardsTop.value;
    const bottom = bodyTop.value + cardsBottom.value;
    const visible = focused.value && scrollY.value + viewport > top && scrollY.value < bottom;
    if (artActive.value !== visible) artActive.value = visible;
  };
  useFocusEffect(useCallback(() => {
    focused.value = true;
    runOnUI(settle)();
    return () => {
      focused.value = false;
      artActive.value = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artActive, focused]));
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => {
      scrollY.value = e.contentOffset.y;
      settle();
    },
  });

  return (
    <ArtActivity.Provider value={artActive}>
    <MotionActivity.Provider value={artActive}>
    <Animated.ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: bottom }} showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" onScroll={onScroll} scrollEventThrottle={16}>
      <View style={[styles.hero, { backgroundImage: d.heroGradient, paddingTop: insets.top + 10 }]}>
        <View style={styles.heroInner}>
          <View style={styles.topRow}>
            <View style={styles.promise}>
              <Text style={styles.kicker}>{firstName ? `Hi ${firstName} · your price in` : 'Fonzkart · your price in'}</Text>
              <View style={styles.bigRow}>
                <Text style={styles.big}>60 seconds</Text>
                <View style={styles.chip}>
                  <Icon name="bolt" color="#14532d" size={12} filled />
                  <Text style={styles.chipText}>CASH</Text>
                </View>
              </View>
              <Text style={styles.subline}>Turn your old devices into <Text style={styles.cash}>cash</Text></Text>
            </View>
            <View style={styles.actions}>
              {signedIn ? <IconButton icon="bell" label="Notifications" tint="onGreen" badge={unread} onPress={() => router.push('/notifications')} /> : null}
              <IconButton icon="profile" label="Profile" tint="onGreen" onPress={() => router.navigate('/profile')} />
            </View>
          </View>
          <SearchBar glass placeholder="Search your device" suggestions={SUGGESTIONS} onPress={() => router.push('/search')} />
        </View>
      </View>

      <View style={styles.body} onLayout={e => { bodyTop.value = e.nativeEvent.layout.y; }}>
        <Appear index={0}>
          <HomeCarousel width={carouselWidth} />
        </Appear>
        <Appear index={1}>
          <SellThisDevice />
        </Appear>

        <View style={styles.cards} onLayout={e => {
          const { y, height } = e.nativeEvent.layout;
          cardsTop.value = y;
          cardsBottom.value = y + height;
        }}>
        <Appear index={1} style={styles.block}>
          <SectionHeader title="Sell your device" subtitle="Choose a category to see your price" />
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
          </View>
        </Appear>

        <Appear index={2} style={styles.block}>
          <SectionHeader title="Repair & protect" subtitle="Fix it, guard it, or recycle it" />
          <View style={styles.grid}>
            <CategoryCard id="repair" name="Repair" width={categoryWidth} index={0} onPress={() => router.navigate('/repair')} />
            <CategoryCard id="screenguard" name="Screen Guard" width={categoryWidth} index={1} onPress={() => router.push('/screen-guard')} />
            <CategoryCard id="bulk" name="Bulk Orders" width={categoryWidth} index={2} onPress={() => router.push('/bulk')} />
          </View>
          <ServiceTiles width={serviceWidth} />
        </Appear>
        </View>

        <Appear index={3} style={styles.block}>
          <SectionHeader title="Top phone brands" action={{ label: 'See all', onPress: () => router.push({ pathname: '/category/[id]', params: { id: 'smartphone' } }) }} />
          {brands.isPending ? (
            <SkeletonTiles count={TOP_BRANDS} width={brandWidth} imageHeight={brandWidth - 30} kind="logo" />
          ) : brands.isError ? (
            <ErrorState error={brands.error} onRetry={() => brands.refetch()} />
          ) : (
            <View style={styles.grid}>
              {brands.data.slice(0, TOP_BRANDS).map(brand => (
                <Tile
                  key={brand.id}
                  label={brand.name}
                  width={brandWidth}
                  onPress={() => router.push({ pathname: '/brand/[id]', params: { id: brand.id, category: 'smartphone', name: brand.name } })}
                  image={<ProductImage uri={brand.logo} label={brand.name} size={brandWidth - 34} kind="logo" />}
                />
              ))}
            </View>
          )}
        </Appear>

        <Appear index={4}>
          <PromiseCard />
        </Appear>
      </View>
    </Animated.ScrollView>
    </MotionActivity.Provider>
    </ArtActivity.Provider>
  );
}

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: { borderBottomLeftRadius: radii.xl, borderBottomRightRadius: radii.xl, paddingBottom: 20 },
  heroInner: { paddingHorizontal: PAGE_PADDING, gap: 14, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  promise: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { ...type.small, fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '700' },
  bigRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 },
  big: { fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -1, color: '#ffffff' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#bbf7d0', borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6, color: '#14532d' },
  subline: { ...type.label, fontSize: 15, color: '#ffffff' },
  actions: { flexDirection: 'row', gap: 8, paddingTop: 2, flexShrink: 0 },
  cash: { color: '#bbf7d0', fontWeight: '900' },
  body: { padding: PAGE_PADDING, gap: 22, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  block: { gap: 12 },
  cards: { gap: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
}));
