// The home screen's banner carousel. Its cards are edited in the Admin app ("Edit carousel view"); a card with a
// category opens that category. Until the Admin app has any cards (or when the server cannot be reached), Fonzkart's
// own banners are shown instead, so the home screen always has its carousel.
import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useCarousel } from '@fonzkart/api';
import { categoryName, imageUrl } from '@fonzkart/core';
import { makeStyles, useColors } from '@fonzkart/ui';
import { Icon, motion, radii, Tap, type, type IconName } from './design';
import { GRID_GAP } from './grid';

const RATIO = 0.5;
const AUTO_ADVANCE_MS = 4000;

type Banner = {
  id: string;
  title: string;
  subtitle: string;
  category: string | null;
  /** A picture from the Admin app, or Fonzkart's own drawn banner. */
  imageUrl?: string;
  art?: { icon: IconName; kicker: string; gradient: string; cta: string };
};

const BUILT_IN: Banner[] = [
  {
    id: 'phone', title: 'Instant cash for your phone', subtitle: 'Price in 60 seconds · free doorstep pickup', category: 'smartphone',
    art: { icon: 'auto', kicker: 'Sell your phone', gradient: 'linear-gradient(125deg, #0f7a37 0%, #16a34a 55%, #34d399 100%)', cta: 'Get price' },
  },
  {
    id: 'laptop', title: 'Old laptop? Top payouts', subtitle: 'MacBooks, Windows laptops and more', category: 'laptop',
    art: { icon: 'laptop', kicker: 'Sell your laptop', gradient: 'linear-gradient(125deg, #052e16 0%, #14532d 55%, #15803d 100%)', cta: 'Sell now' },
  },
  {
    id: 'watch', title: 'Smartwatches & earbuds too', subtitle: 'Apple, Samsung, OnePlus and more', category: 'watch',
    art: { icon: 'watch', kicker: 'More than phones', gradient: 'linear-gradient(125deg, #065f46 0%, #059669 55%, #6ee7b7 100%)', cta: 'Explore' },
  },
  {
    id: 'bulk', title: 'Selling in bulk?', subtitle: 'Corporate IT assets and e-waste recycling', category: null,
    art: { icon: 'building', kicker: 'For businesses', gradient: 'linear-gradient(125deg, #0b2316 0%, #14532d 60%, #16a34a 100%)', cta: 'Talk to us' },
  },
];

export function HomeCarousel({ width }: { width: number }) {
  const styles = useStyles();
  const router = useRouter();
  const carousel = useCarousel();
  const fromAdmin = (carousel.data ?? []).map<Banner>(s => ({ id: s.id, title: s.title, subtitle: s.subtitle, category: s.category, imageUrl: s.imageUrl }));
  const slides = fromAdmin.length ? fromAdmin : BUILT_IN;
  const list = useRef<FlatList<Banner>>(null);
  const [index, setIndex] = useState(0);
  const [touching, setTouching] = useState(false);
  const step = width + GRID_GAP;

  // Fewer cards after a refresh: start again from the first.
  useEffect(() => {
    if (index >= slides.length && slides.length) {
      setIndex(0);
      list.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [index, slides.length]);

  // Move on every few seconds, except while the customer is swiping.
  useEffect(() => {
    if (slides.length < 2 || touching) return undefined;
    const timer = setTimeout(() => {
      const next = (index + 1) % slides.length;
      list.current?.scrollToOffset({ offset: next * step, animated: true });
      setIndex(next);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [index, touching, slides.length, step]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.max(0, Math.min(slides.length - 1, Math.round(e.nativeEvent.contentOffset.x / step))));
    setTouching(false);
  };
  const open = (banner: Banner) => {
    if (banner.category) router.push({ pathname: '/category/[id]', params: { id: banner.category } });
    else if (banner.art) router.push('/bulk');
  };

  return (
    <View style={styles.box}>
      <FlatList
        ref={list}
        data={slides}
        keyExtractor={s => s.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        ItemSeparatorComponent={Gap}
        onScrollBeginDrag={() => setTouching(true)}
        onMomentumScrollEnd={settle}
        getItemLayout={(_, i) => ({ length: step, offset: step * i, index: i })}
        renderItem={({ item }) => (
          <Slide banner={item} width={width} onPress={item.category || item.art ? () => open(item) : undefined} />
        )}
      />
      {slides.length > 1 ? (
        <View style={styles.dots} accessibilityLabel={`Card ${index + 1} of ${slides.length}`}>
          {slides.map((s, i) => <Dot key={s.id} active={i === index} />)}
        </View>
      ) : null}
    </View>
  );
}

function Gap() {
  return <View style={{ width: GRID_GAP }} />;
}

/** A page dot that stretches into a green pill when its card is showing. */
function Dot({ active }: { active: boolean }) {
  const colors = useColors();
  const style = useAnimatedStyle(() => ({
    width: withSpring(active ? 20 : 6, motion.snappy),
    backgroundColor: active ? colors.green : colors.track,
  }));
  return <Animated.View style={[{ height: 6, borderRadius: 3 }, style]} />;
}

function Slide({ banner, width, onPress }: { banner: Banner; width: number; onPress?: () => void }) {
  const styles = useStyles();
  const height = Math.round(width * RATIO);
  const uri = imageUrl(banner.imageUrl);
  const label = [banner.title, banner.subtitle, banner.category ? `Opens ${categoryName(banner.category) ?? banner.category}` : '']
    .filter(Boolean).join('. ');
  const art = banner.art;
  return (
    <Tap onPress={onPress} disabled={!onPress} scaleTo={0.98} accessibilityRole={onPress ? 'button' : 'image'} accessibilityLabel={label}
      style={[styles.slide, { width, height }, art && { backgroundImage: art.gradient }]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      {uri ? <View style={[StyleSheet.absoluteFill, styles.fade]} /> : null}
      {art ? (
        <>
          {/* soft light rings behind the device icon */}
          <View style={[styles.ring, { width: height * 1.2, height: height * 1.2, borderRadius: height * 0.6, right: -height * 0.25, top: -height * 0.1 }]} />
          <View style={[styles.ring, { width: height * 0.8, height: height * 0.8, borderRadius: height * 0.4, right: -height * 0.05, top: height * 0.1 }]} />
          <View style={[styles.artIcon, { right: height * 0.12, top: height * 0.2 }]}>
            <Icon name={art.icon} color="#ffffff" size={height * 0.5} filled strokeWidth={1.4} />
          </View>
          <View style={styles.artText}>
            <Text style={styles.kicker}>{art.kicker}</Text>
            <Text style={styles.artTitle} numberOfLines={2}>{banner.title}</Text>
            <Text style={styles.artSubtitle} numberOfLines={2}>{banner.subtitle}</Text>
            <View style={styles.cta}>
              <Text style={styles.ctaText}>{art.cta}</Text>
              <Icon name="chevronRight" color="#14532d" size={14} strokeWidth={2.6} />
            </View>
          </View>
        </>
      ) : (
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>{banner.title}</Text>
          {banner.subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{banner.subtitle}</Text> : null}
        </View>
      )}
    </Tap>
  );
}

const useStyles = makeStyles(colors => ({
  box: { gap: 10 },
  slide: { borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.navy, justifyContent: 'flex-end' },
  fade: { backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.7) 100%)' },
  text: { padding: 14, gap: 2 },
  title: { ...type.heading, fontWeight: '800', color: '#ffffff' },
  subtitle: { ...type.small, color: '#ffffff', opacity: 0.9 },
  ring: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.08)' },
  artIcon: { position: 'absolute', opacity: 0.95 },
  artText: { position: 'absolute', left: 16, top: 14, bottom: 14, right: '38%', justifyContent: 'center', gap: 3 },
  kicker: { ...type.tiny, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' },
  artTitle: { ...type.heading, fontSize: 19, lineHeight: 23, fontWeight: '800', color: '#ffffff' },
  artSubtitle: { ...type.small, fontSize: 12, color: 'rgba(255,255,255,0.88)' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#ffffff', borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
  ctaText: { ...type.small, fontWeight: '800', color: '#14532d' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
}));
