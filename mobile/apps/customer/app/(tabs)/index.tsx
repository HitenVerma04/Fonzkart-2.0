// Home, laid out like Blinkit's: a header (white, or near-black in dark mode) with the animated Fonzkart "F", the name,
// "Buy • Sell • Repair • Refurbish", the bell, profile and the search bar; then "Pick up where you left off" (when a valuation was left part-way), the
// carousel, "Sell this phone" (Cashify's), the animated sell categories, Repair & Protect, a row of top phone brands,
// and the Fonzkart promise in a dark card (CRED's style).
import { useCallback } from 'react';
import { Platform, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  runOnUI, useAnimatedReaction, useAnimatedScrollHandler, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useBrands, useNotifications, useSession } from '@fonzkart/api';
import { SELL_CATEGORIES } from '@fonzkart/core';
import { makeStyles, useColors, useTheme } from '@fonzkart/ui';
import { CategoryCard } from '../../src/categoryArt/CategoryCard';
import { FestiveDecor } from '../../src/festive/FestiveDecor';
import { ArtActivity, MotionActivity } from '../../src/categoryArt/motion';
import {
  Appear, ErrorState, festiveGreeting, IconButton, MAX_CONTENT, ProductImage, radii, SearchBar, SectionHeader, Tap, type, useDesign,
  useTabBarSpace,
} from '../../src/design';
import { HomeCarousel } from '../../src/HomeCarousel';
import { FactoryBackground } from '../../src/home/FactoryBackground';
import { HeroLogo } from '../../src/home/HeroLogo';
import { ResumeCard } from '../../src/home/ResumeCard';
import { PromiseCard } from '../../src/home/sections';
import { SellThisDevice } from '../../src/home/SellThisDevice';
import { GRID_GAP, PAGE_PADDING, useTileWidth } from '../../src/grid';
import { launchCovering, launchTarget } from '../../src/launchTargets';

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
  const brandWidth = useTileWidth(5);
  const brands = useBrands('smartphone');
  const { session } = useSession();
  const signedIn = session.status === 'signedIn';
  const inbox = useNotifications(signedIn);
  const unread = inbox.data?.some(n => !n.isRead) ?? false;
  const firstName = signedIn ? session.user.name.trim().split(/\s+/)[0] : '';
  const greeting = festiveGreeting(d.festive);
  const colors = useColors();
  const dark = useTheme().scheme === 'dark';
  const festive = d.festive !== 'none';
  const onDark = festive || dark;

  // The status bar over the header: white on the festive (coloured) and dark headers, black on the plain light one.
  // Other screens get the theme's style back when this one loses focus.
  const navigation = useNavigation();
  useFocusEffect(useCallback(() => {
    const here = onDark ? 'light' : 'dark';
    const theme = dark ? 'light' : 'dark';
    const apply = (style: 'light' | 'dark') => {
      if (Platform.OS === 'ios') navigation.getParent()?.setOptions({ statusBarStyle: style });
      else setStatusBarStyle(style);
    };
    apply(here);
    return () => apply(theme);
  }, [navigation, onDark, dark]));

  // The category cards (drawn by Skia on the GPU, see categoryArt/skiaSvg) and the other drawings animate while the
  // page is still. They hold still while it scrolls (a finger on it, or the fling after), so every frame goes to moving
  // the page, and pick up again where they stopped once it rests. They also pause while nobody can see them: another
  // screen or the launch animation covers this one, or the cards are scrolled completely off screen.
  const { height: viewport } = useWindowDimensions();
  const artActive = useSharedValue(!launchCovering.value);
  const focused = useSharedValue(true);
  const factoryActive = useSharedValue(!launchCovering.value);
  const scrolling = useSharedValue(false);
  const flinging = useSharedValue(false);
  const restTimer = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const bodyTop = useSharedValue(0);
  const cardsTop = useSharedValue(0);
  const cardsBottom = useSharedValue(Number.MAX_SAFE_INTEGER);
  const settle = () => {
    'worklet';
    const top = bodyTop.value + cardsTop.value;
    const bottom = bodyTop.value + cardsBottom.value;
    const shown = focused.value && !launchCovering.value;
    const still = shown && !scrolling.value;
    const visible = still && scrollY.value + viewport > top && scrollY.value < bottom;
    if (artActive.value !== visible) artActive.value = visible;
    if (factoryActive.value !== still) factoryActive.value = still;
  };
  const setScrolling = (on: boolean) => {
    'worklet';
    if (scrolling.value === on) return;
    scrolling.value = on;
    settle();
  };
  useFocusEffect(useCallback(() => {
    focused.value = true;
    runOnUI(settle)();
    return () => {
      focused.value = false;
      artActive.value = false;
      factoryActive.value = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artActive, factoryActive, focused]));
  useAnimatedReaction(() => launchCovering.value, (covering, previous) => {
    if (previous !== null && covering !== previous) settle();
  });
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => {
      scrollY.value = e.contentOffset.y;
      if (!scrolling.value) settle();
    },
    onBeginDrag: () => {
      flinging.value = false;
      setScrolling(true);
    },
    onMomentumBegin: () => {
      flinging.value = true;
      setScrolling(true);
    },
    // A slow release has no fling after it, so the page rests already. Otherwise the fling's end resumes them; if no
    // fling starts after all (a release at the end of the page), they resume shortly anyway.
    onEndDrag: e => {
      if (Math.abs(e.velocity?.y ?? 0) < 0.05) setScrolling(false);
      else {
        restTimer.value = 0;
        restTimer.value = withDelay(400, withTiming(1, { duration: 0 }, done => {
          if (done && !flinging.value) setScrolling(false);
        }));
      }
    },
    onMomentumEnd: () => {
      flinging.value = false;
      setScrolling(false);
    },
  });

  return (
    <View style={styles.screen}>
    <ArtActivity.Provider value={factoryActive}>
      <FactoryBackground scrollY={scrollY} contentHeight={contentHeight} />
    </ArtActivity.Provider>
    <ArtActivity.Provider value={artActive}>
    <MotionActivity.Provider value={artActive}>
    <Animated.ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: bottom }} showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" onScroll={onScroll} scrollEventThrottle={16}
      onContentSizeChange={(_, h) => { contentHeight.value = h; }}>
      <View style={[styles.hero, festive ? styles.heroFestive : dark ? styles.heroDark : styles.heroLight,
        festive && { backgroundImage: d.heroGradient }, { paddingTop: insets.top + 12 }]}>
        <FestiveDecor />
        <View style={styles.heroInner}>
          {greeting || firstName ? (
            <Text style={[styles.kicker, { color: onDark ? d.heroAccent : colors.greenDark }]} numberOfLines={1}>{greeting || `Hi ${firstName}`}</Text>
          ) : null}
          <View style={styles.topRow}>
            <HeroLogo onDark={onDark} accent={festive ? d.heroAccent : '#22c55e'} />
            <View style={styles.actions}>
              <IconButton icon="bell" label="Notifications" tint={festive ? 'onGreen' : 'outline'} badge={signedIn && unread}
                onPress={() => router.push('/notifications')} />
              <IconButton icon="profile" label="Profile" tint={festive ? 'onGreen' : 'outline'} onPress={() => router.navigate('/profile')} />
            </View>
          </View>
          <SearchBar glass={festive} placeholder="Search for devices, brands or services" suggestions={SUGGESTIONS}
            onPress={() => router.push('/search')} />
        </View>
      </View>

      <View style={styles.body} onLayout={e => { bodyTop.value = e.nativeEvent.layout.y; }}>
        <ResumeCard />
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
          <SectionHeader big title="Sell Your Device" subtitle="Choose a category to see your price" />
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
          <SectionHeader big title="Repair & Protect" subtitle="Fix, guard or extend your device life"
            action={{ label: 'See all', onPress: () => router.navigate('/repair') }} />
          <View style={styles.grid}>
            <CategoryCard id="repair" name="Repair" width={categoryWidth} index={0} onPress={() => router.navigate('/repair')} />
            <View ref={launchTarget('screenguard')} collapsable={false}>
              <CategoryCard id="screenguard" name="Screen Guard" width={categoryWidth} index={1} onPress={() => router.push('/screen-guard')} />
            </View>
            <CategoryCard id="bulk" name="Bulk Orders" width={categoryWidth} index={2} onPress={() => router.push('/bulk')} />
          </View>
        </Appear>
        </View>

        <Appear index={3} style={styles.block}>
          <SectionHeader big title="Top Phone Brands" subtitle="Pick your brand to get a price"
            action={{ label: 'See all', onPress: () => router.push({ pathname: '/category/[id]', params: { id: 'smartphone' } }) }} />
          {brands.isPending ? (
            <View style={styles.brandRow}>
              {Array.from({ length: 5 }, (_, i) => <View key={i} style={[styles.brandTile, styles.brandSkeleton, { width: brandWidth, height: brandWidth }]} />)}
            </View>
          ) : brands.isError ? (
            <ErrorState error={brands.error} onRetry={() => brands.refetch()} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandScroll} contentContainerStyle={styles.brandRow}>
              {brands.data.slice(0, TOP_BRANDS).map(brand => (
                <Tap key={brand.id} scaleTo={0.92} accessibilityRole="button" accessibilityLabel={brand.name}
                  onPress={() => router.push({ pathname: '/brand/[id]', params: { id: brand.id, category: 'smartphone', name: brand.name } })}
                  style={[styles.brandTile, { width: brandWidth, height: brandWidth, boxShadow: d.shadow.sm }]}>
                  <ProductImage uri={brand.logo} label={brand.name} size={Math.round(brandWidth * 0.6)} kind="logo" />
                </Tap>
              ))}
            </ScrollView>
          )}
        </Appear>

        <Appear index={4}>
          <PromiseCard />
        </Appear>
      </View>
    </Animated.ScrollView>
    </MotionActivity.Provider>
    </ArtActivity.Provider>
    {/* Behind the clock and the Dynamic Island: the header's colour stays there while the page scrolls under it. */}
    <View pointerEvents="none" style={[styles.topInset, { height: insets.top },
      festive ? { backgroundImage: d.heroGradient } : { backgroundColor: dark ? '#050a07' : '#ffffff' }]} />
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  hero: { borderBottomLeftRadius: radii.xl, borderBottomRightRadius: radii.xl, paddingBottom: 20 },
  heroInner: { paddingHorizontal: PAGE_PADDING, gap: 14, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  // the header: white with a hint of green in light mode, near-black with a hint of green in dark mode, the festive
  // theme's gradient while one is on
  heroLight: { backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #f1faf4 100%)', borderBottomWidth: 1, borderColor: colors.border },
  heroDark: { backgroundImage: 'linear-gradient(180deg, #050a07 0%, #0b1610 100%)', borderBottomWidth: 1, borderColor: 'rgba(74,222,128,0.14)' },
  heroFestive: {},
  topInset: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  kicker: { ...type.small, fontSize: 13, fontWeight: '700', marginBottom: -6 },
  actions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  body: { padding: PAGE_PADDING, gap: 24, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  block: { gap: 12 },
  cards: { gap: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  brandScroll: { marginHorizontal: -PAGE_PADDING },
  brandRow: { flexDirection: 'row', gap: GRID_GAP, paddingHorizontal: PAGE_PADDING, paddingVertical: 2 },
  brandTile: {
    borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  brandSkeleton: { backgroundColor: colors.placeholder, borderWidth: 0 },
}));
