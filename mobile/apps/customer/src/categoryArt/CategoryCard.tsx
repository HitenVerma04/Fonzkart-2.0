// A home-screen category card like the website's (components/sell/CategorySelector.tsx): a tinted card with its name,
// the animated drawing and a small caption under it; pastel in light mode, a deep shade of the same hue in dark mode. Cards fade and grow in
// one after another. Depth: the drawing tilts slowly in 3D (a native view transform) and the card has a glossy
// highlight.
//
// The whole card (text included) scales with its width from a 112 dp reference card, so the drawing area keeps the
// same shape and shows the same part of each drawing on every phone. The card text ignores the phone's font-size
// setting for the same reason; the card's name is also its accessibility label.
//
// Every card animates its drawing fully (drawn by Skia on the GPU) and floats and tilts as a whole (a native view
// transform).
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withDelay, withTiming } from 'react-native-reanimated';
import { radius, useTheme } from '@fonzkart/ui';
import { Tap } from '../design';
import { ArtBackground, useLoop } from './motion';
import { CATEGORY_ART } from './art';
import type { HomeTileId } from './graphics';

const CARD_RATIO = 1.4;
const REFERENCE_WIDTH = 112;
const NAME_AREA = 28; // padding above the name, and the name (at the reference width)
const CAPTION_AREA = 28; // two caption lines and the space under them

const LOOK: Record<HomeTileId, { background: string; text: string; caption: string }> = {
  smartphone: { background: '#eff6ff', text: '#1e3a8a', caption: 'Instant cash for your phone' },
  tablet: { background: '#faf5ff', text: '#581c87', caption: 'Instant cash for your tablet' },
  camera: { background: '#fff1f2', text: '#881337', caption: 'Premium value for your gear' },
  laptop: { background: '#ecfeff', text: '#164e63', caption: 'Upgrade today, highest payouts' },
  watch: { background: '#fff7ed', text: '#7c2d12', caption: 'Top market prices guaranteed' },
  smarttv: { background: '#ecfdf5', text: '#064e3b', caption: 'Best value for your television' },
  console: { background: '#eef2ff', text: '#312e81', caption: 'Instant cash for your console' },
  desktop: { background: '#f0fdf4', text: '#064e3b', caption: 'Turn your old PC into cash' },
  earbuds: { background: '#fdf4ff', text: '#701a75', caption: 'Instant quote and fast money' },
  repair: { background: '#fef2f2', text: '#7f1d1d', caption: 'Quick, reliable, affordable' },
  screenguard: { background: '#f0fdfa', text: '#083344', caption: 'Doorstep fitting · coming soon' },
  bulk: { background: '#fff8eb', text: '#78350f', caption: 'For businesses · cash for IT assets' },
};

/** Dark mode: the same hue, deep instead of pastel, with light text. */
const DARK: Record<HomeTileId, { background: string; text: string }> = {
  smartphone: { background: '#0f1d3a', text: '#bfdbfe' },
  tablet: { background: '#22123a', text: '#e9d5ff' },
  camera: { background: '#2d1018', text: '#fecdd3' },
  laptop: { background: '#0b2630', text: '#a5f3fc' },
  watch: { background: '#2e1a0c', text: '#fed7aa' },
  smarttv: { background: '#0a2a1f', text: '#a7f3d0' },
  console: { background: '#171a3d', text: '#c7d2fe' },
  desktop: { background: '#0c2416', text: '#bbf7d0' },
  earbuds: { background: '#2a1030', text: '#f5d0fe' },
  repair: { background: '#2e1111', text: '#fecaca' },
  screenguard: { background: '#082a28', text: '#99f6e4' },
  bulk: { background: '#2e1f08', text: '#fde68a' },
};

/** The website's entrance: opacity 0 → 1 and scale 0.95 → 1 over 0.4 s, 0.1 s after the card before. */
function appear(index: number) {
  return () => {
    'worklet';
    const delay = index * 100;
    return {
      initialValues: { opacity: 0, transform: [{ scale: 0.95 }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, { duration: 400 })),
        transform: [{ scale: withDelay(delay, withTiming(1, { duration: 400 })) }],
      },
    };
  };
}

/** The drawing, re-rendered only when its size changes (not when the card's still/moving state does). */
const CardArt = memo(function CardArt({ id, width, height }: { id: HomeTileId; width: number; height: number }) {
  const Art = CATEGORY_ART[id];
  return <Art width={width} height={height} />;
});

export function CategoryCard({ id, name, width, index, onPress, badge }: {
  id: HomeTileId;
  name: string;
  width: number;
  index: number;
  onPress: () => void;
  /** A small pill in the corner ("SOON"). */
  badge?: string;
}) {
  const dark = useTheme().scheme === 'dark';
  const look = dark ? { ...LOOK[id], ...DARK[id] } : LOOK[id];
  const sway = useLoop(7, (index % 3) * 0.6, 'motion');
  const tilt = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateX: '6deg' }, { rotateY: `${-9 + sway.value * 18}deg` }],
  }));
  const k = width / REFERENCE_WIDTH;
  const height = Math.round(width * CARD_RATIO);
  const nameArea = Math.round(NAME_AREA * k);
  const captionArea = Math.round(CAPTION_AREA * k);
  return (
    <Animated.View entering={appear(index)}>
      <Tap
        onPress={onPress}
        scaleTo={0.94}
        accessibilityRole="button"
        accessibilityLabel={name}
        style={[styles.card, dark && styles.cardDark, { width, height, backgroundColor: look.background }]}
      >
        <View pointerEvents="none" style={[styles.gloss, dark && styles.glossDark]} />
        {badge ? <Text style={[styles.badge, { fontSize: 8.5 * k, paddingHorizontal: 6 * k, top: 6 * k, right: 6 * k }]} maxFontSizeMultiplier={1}>{badge}</Text> : null}
        <Text style={[styles.name, { color: look.text, height: nameArea, paddingTop: 8 * k, paddingHorizontal: 8 * k, fontSize: (name.length > 10 ? 13.5 : 15) * k, lineHeight: 20 * k }]}
          numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1}>{name}</Text>
        <View style={styles.art} pointerEvents="none">
          <Animated.View style={tilt}>
            <ArtBackground.Provider value={look.background}>
              <CardArt id={id} width={width} height={height - nameArea - captionArea} />
            </ArtBackground.Provider>
          </Animated.View>
        </View>
        <Text style={[styles.caption, { color: look.text, height: captionArea, paddingHorizontal: 8 * k, paddingTop: 2 * k, fontSize: 8 * k, lineHeight: 10 * k }]}
          numberOfLines={2} maxFontSizeMultiplier={1}>{look.caption}</Text>
      </Tap>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(15,31,23,0.08)' },
  name: { fontWeight: '900', letterSpacing: -0.4 },
  art: { flex: 1, alignItems: 'center', overflow: 'hidden' },
  cardDark: { borderColor: 'rgba(255,255,255,0.1)' },
  badge: {
    position: 'absolute', zIndex: 2, overflow: 'hidden', borderRadius: 999, paddingVertical: 2, backgroundColor: '#16a34a', color: '#ffffff',
    fontWeight: '900', letterSpacing: 0.6,
  },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'linear-gradient(150deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 40%)' },
  glossDark: { backgroundImage: 'linear-gradient(150deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 40%)' },
  caption: {
    textAlign: 'center', fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', opacity: 0.8,
  },
});
