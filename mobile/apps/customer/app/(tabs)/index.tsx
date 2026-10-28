// Home: a green header with the brand, greeting, notifications and the search bar; the carousel; the sell
// categories; Fonzkart's services; top phone brands; and how selling works.
import { useCallback, useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useBrands, useNotifications, useSession } from '@fonzkart/api';
import { SELL_CATEGORIES } from '@fonzkart/core';
import { Logo, makeStyles } from '@fonzkart/ui';
import { CategoryCard } from '../../src/categoryArt/CategoryCard';
import { ArtActivity, Spotlight } from '../../src/categoryArt/motion';
import {
  Appear, ErrorState, Icon, IconBadge, IconButton, MAX_CONTENT, ProductImage, radii, SearchBar, SectionHeader, SkeletonTiles,
  Tile, type, useDesign, useTabBarSpace, type IconName,
} from '../../src/design';
import { HomeCarousel } from '../../src/HomeCarousel';
import { GRID_GAP, PAGE_PADDING, useTileWidth } from '../../src/grid';

const TOP_BRANDS = 8;
const SPOTLIGHT_MS = 3500;
const SPOTLIGHT_ORDER = [...SELL_CATEGORIES.map(c => c.id), 'repair', 'screenguard', 'bulk'];
const SUGGESTIONS = ['iPhone 13', 'Galaxy S23', 'OnePlus 11', 'iPad Air', 'MacBook Air', 'Apple Watch'];
const PERKS: { icon: IconName; label: string }[] = [
  { icon: 'bolt', label: 'Instant cash' },
  { icon: 'truck', label: 'Free pickup' },
  { icon: 'shield', label: 'Safe & secure' },
];
const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'sparkle', title: 'Get your price', text: 'Pick your device and answer a few questions.' },
  { icon: 'truck', title: 'Free doorstep pickup', text: 'Choose a time; our executive comes to you.' },
  { icon: 'wallet', title: 'Get paid instantly', text: 'Cash, UPI or bank transfer on the spot.' },
];

export default function Home() {
  const styles = useStyles();
  const d = useDesign();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const categoryWidth = useTileWidth(3);
  const carouselWidth = useTileWidth(1);
  const brandWidth = useTileWidth(4);
  const brands = useBrands('smartphone');
  const { session } = useSession();
  const signedIn = session.status === 'signedIn';
  const inbox = useNotifications(signedIn);
  const unread = inbox.data?.some(n => !n.isRead) ?? false;
  const firstName = signedIn ? session.user.name.trim().split(/\s+/)[0] : '';

  // The category drawings move only while this screen is in front and the list is still: animating a dozen SVGs
  // during a scroll or a screen transition is what made both stutter.
  const artActive = useSharedValue(true);
  const focused = useSharedValue(true);
  const scrolling = useSharedValue(false);
  useFocusEffect(useCallback(() => {
    focused.value = true;
    artActive.value = !scrolling.value;
    return () => {
      focused.value = false;
      artActive.value = false;
    };
  }, [artActive, focused, scrolling]));
  // One card at a time plays its drawing's full animation, moving on every few seconds (like a store's featured
  // tile); the rest float and tilt as ready-drawn pictures. Redrawing a dozen SVGs every frame is what dropped frames.
  const spotlight = useSharedValue<string | null>(SPOTLIGHT_ORDER[0]!);
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % SPOTLIGHT_ORDER.length;
      spotlight.value = SPOTLIGHT_ORDER[i]!;
    }, SPOTLIGHT_MS);
    return () => clearInterval(timer);
  }, [spotlight]);
  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: () => {
      scrolling.value = true;
      artActive.value = false;
    },
    onEndDrag: e => {
      // No fling: the list stops here. Otherwise wait for the momentum to end.
      if (Math.abs(e.velocity?.y ?? 0) < 0.05) {
        scrolling.value = false;
        artActive.value = focused.value;
      }
    },
    onMomentumEnd: () => {
      scrolling.value = false;
      artActive.value = focused.value;
    },
  });

  return (
    <ArtActivity.Provider value={artActive}>
    <Spotlight.Provider value={spotlight}>
    <Animated.ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: bottom }} showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" onScroll={onScroll} scrollEventThrottle={16}>
      <View style={[styles.hero, { backgroundImage: d.heroGradient, paddingTop: insets.top + 10 }]}>
        <View style={styles.heroInner}>
          <View style={styles.topRow}>
            <View style={styles.brand}>
              <View style={styles.logoChip}>
                <Logo variant="f" height={30} />
              </View>
              <View>
                <Text style={styles.hello}>{firstName ? `Hi ${firstName} 👋` : 'Welcome to'}</Text>
                <Text style={styles.brandName}>Fonzkart</Text>
              </View>
            </View>
            <View style={styles.actions}>
              {signedIn ? <IconButton icon="bell" label="Notifications" tint="onGreen" badge={unread} onPress={() => router.push('/notifications')} /> : null}
              <IconButton icon="profile" label="Profile" tint="onGreen" onPress={() => router.navigate('/profile')} />
            </View>
          </View>

          <Text style={styles.title}>Turn your old devices into <Text style={styles.cash}>cash</Text></Text>
          <SearchBar glass placeholder="Search your device" suggestions={SUGGESTIONS} onPress={() => router.push('/search')} />
          <View style={styles.perks}>
            {PERKS.map(p => (
              <View key={p.label} style={styles.perk}>
                <Icon name={p.icon} color="#ffffff" size={15} />
                <Text style={styles.perkText}>{p.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <Appear index={0}>
          <HomeCarousel width={carouselWidth} />
        </Appear>

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
          <SectionHeader title="More from Fonzkart" />
          <View style={styles.grid}>
            <CategoryCard id="repair" name="Repair" width={categoryWidth} index={0} onPress={() => router.navigate('/repair')} />
            <CategoryCard id="screenguard" name="Screen Guard" width={categoryWidth} index={1} onPress={() => router.push('/screen-guard')} />
            <CategoryCard id="bulk" name="Bulk Orders" width={categoryWidth} index={2} onPress={() => router.push('/bulk')} />
          </View>
        </Appear>

        <Appear index={3} style={styles.block}>
          <SectionHeader title="Top phone brands" action={{ label: 'See all', onPress: () => router.push({ pathname: '/category/[id]', params: { id: 'smartphone' } }) }} />
          {brands.isPending ? (
            <SkeletonTiles count={TOP_BRANDS} width={brandWidth} imageHeight={brandWidth - 30} />
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
                  image={<ProductImage uri={brand.logo} label={brand.name} size={brandWidth - 34} />}
                />
              ))}
            </View>
          )}
        </Appear>

        <Appear index={4} style={styles.block}>
          <SectionHeader title="How Fonzkart works" />
          <View style={[styles.steps, { boxShadow: d.shadow.sm }]}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={styles.step}>
                <IconBadge name={s.icon} size={44} />
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{i + 1}. {s.title}</Text>
                  <Text style={styles.stepBody}>{s.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </Appear>
      </View>
    </Animated.ScrollView>
    </Spotlight.Provider>
    </ArtActivity.Provider>
  );
}

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: { borderBottomLeftRadius: radii.xl, borderBottomRightRadius: radii.xl, paddingBottom: 22 },
  heroInner: { paddingHorizontal: PAGE_PADDING, gap: 16, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoChip: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  hello: { ...type.small, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  brandName: { ...type.heading, fontSize: 20, fontWeight: '800', color: '#ffffff', letterSpacing: -0.3 },
  actions: { flexDirection: 'row', gap: 8 },
  title: { ...type.display, color: '#ffffff', marginTop: 4 },
  cash: { color: '#bbf7d0' },
  perks: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  perkText: { ...type.small, fontSize: 12, fontWeight: '700', color: '#ffffff' },
  body: { padding: PAGE_PADDING, gap: 22, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  block: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  steps: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 16 },
  step: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { ...type.label, fontSize: 15, color: colors.navy },
  stepBody: { ...type.small, color: colors.muted },
}));
