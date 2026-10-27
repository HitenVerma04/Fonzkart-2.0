// The home screen's carousel under "Choose a category". Its cards are edited in the Admin app ("Edit carousel view");
// a card with a category opens that category. Nothing is shown while there are no visible cards (or no answer).
import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useCarousel, type CarouselSlide } from '@fonzkart/api';
import { categoryName, imageUrl } from '@fonzkart/core';
import { font, makeStyles, radius, spacing } from '@fonzkart/ui';
import { GRID_GAP } from './grid';

const RATIO = 9 / 16;
const AUTO_ADVANCE_MS = 4000;

export function HomeCarousel({ width }: { width: number }) {
  const styles = useStyles();
  const router = useRouter();
  const carousel = useCarousel();
  const slides = carousel.data ?? [];
  const list = useRef<FlatList<CarouselSlide>>(null);
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

  if (!slides.length) return null;

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.max(0, Math.min(slides.length - 1, Math.round(e.nativeEvent.contentOffset.x / step))));
    setTouching(false);
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
          <Slide
            slide={item}
            width={width}
            onPress={item.category ? () => router.push({ pathname: '/category/[id]', params: { id: item.category! } }) : undefined}
          />
        )}
      />
      {slides.length > 1 ? (
        <View style={styles.dots} accessibilityLabel={`Card ${index + 1} of ${slides.length}`}>
          {slides.map((s, i) => <View key={s.id} style={[styles.dot, i === index && styles.dotActive]} />)}
        </View>
      ) : null}
    </View>
  );
}

function Gap() {
  return <View style={{ width: GRID_GAP }} />;
}

function Slide({ slide, width, onPress }: { slide: CarouselSlide; width: number; onPress?: () => void }) {
  const styles = useStyles();
  const height = Math.round(width * RATIO);
  const uri = imageUrl(slide.imageUrl);
  const label = [slide.title, slide.subtitle, slide.category ? `Opens ${categoryName(slide.category) ?? slide.category}` : '']
    .filter(Boolean).join('. ');
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.slide, { width, height }, pressed && styles.pressed]}
    >
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      {/* A dark fade at the bottom so the white text reads on any picture. */}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.35" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.7} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#fade)" />
      </Svg>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>{slide.title}</Text>
        {slide.subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{slide.subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(colors => ({
  box: { gap: spacing.sm, marginTop: spacing.md },
  slide: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.navy, justifyContent: 'flex-end' },
  pressed: { opacity: 0.85 },
  text: { padding: spacing.md, gap: 2 },
  title: { fontSize: font.heading, fontWeight: '800', color: colors.white },
  subtitle: { fontSize: font.small, color: colors.white, opacity: 0.9 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 18, backgroundColor: colors.green },
}));
