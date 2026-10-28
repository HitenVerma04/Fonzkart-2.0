// A home-screen category card like the website's (components/sell/CategorySelector.tsx), tinted card in light mode, the
// website's glassy card and light text in dark mode; name, the animated drawing, and the small caption under it. Cards
// fade and grow in one after another. Depth: the drawing tilts slowly in 3D (a native view transform, cheap while
// scrolling), stands on a soft shadow, and the card has a glossy highlight.
//
// The whole card (text included) scales with its width from a 112 dp reference card, so the drawing area keeps the
// same shape and shows the same part of each drawing on every phone. The card text ignores the phone's font-size
// setting for the same reason; the card's name is also its accessibility label.
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withDelay, withTiming } from 'react-native-reanimated';
import { radius, useTheme } from '@fonzkart/ui';
import { Tap } from '../design';
import { useLoop } from './motion';
import { CATEGORY_ART, type HomeTileId } from './graphics';

const CARD_RATIO = 1.4;
const REFERENCE_WIDTH = 112;
const NAME_AREA = 28; // padding above the name, and the name (at the reference width)
const CAPTION_AREA = 28; // two caption lines and the space under them

const LOOK: Record<HomeTileId, { background: string; text: string; darkText: string; caption: string }> = {
  smartphone: { background: '#eff6ff', text: '#1e3a8a', darkText: '#dbeafe', caption: 'Instant cash for your phone' },
  tablet: { background: '#faf5ff', text: '#581c87', darkText: '#f3e8ff', caption: 'Instant cash for your tablet' },
  camera: { background: '#fff1f2', text: '#881337', darkText: '#ffe4e6', caption: 'Premium value for your gear' },
  laptop: { background: '#ecfeff', text: '#164e63', darkText: '#cffafe', caption: 'Upgrade today, highest payouts' },
  watch: { background: '#fff7ed', text: '#7c2d12', darkText: '#ffedd5', caption: 'Top market prices guaranteed' },
  smarttv: { background: '#ecfdf5', text: '#064e3b', darkText: '#d1fae5', caption: 'Best value for your television' },
  console: { background: '#eef2ff', text: '#312e81', darkText: '#e0e7ff', caption: 'Instant cash for your console' },
  desktop: { background: '#f0fdf4', text: '#064e3b', darkText: '#6ee7b7', caption: 'Turn your old PC into cash' },
  earbuds: { background: '#fdf4ff', text: '#701a75', darkText: '#f0abfc', caption: 'Instant quote and fast money' },
  repair: { background: '#fef2f2', text: '#7f1d1d', darkText: '#fee2e2', caption: 'Quick, reliable, affordable' },
  screenguard: { background: '#f0fdfa', text: '#083344', darkText: '#67e8f9', caption: 'Unbreakable • 3-hr doorstep' },
  bulk: { background: '#ecfdf5', text: '#064e3b', darkText: '#6ee7b7', caption: 'Corporate & recycling' },
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

export function CategoryCard({ id, name, width, index, onPress }: {
  id: HomeTileId;
  name: string;
  width: number;
  index: number;
  onPress: () => void;
}) {
  const Art = CATEGORY_ART[id];
  const look = LOOK[id];
  const dark = useTheme().scheme === 'dark';
  const text = dark ? look.darkText : look.text;
  const sway = useLoop(7, (index % 3) * 0.6);
  const tilt = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateX: '6deg' }, { rotateY: `${-9 + sway.value * 18}deg` }],
  }));
  const ground = useAnimatedStyle(() => ({ transform: [{ scaleX: 0.85 + Math.abs(sway.value - 0.5) * 0.3 }] }));
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
        style={[styles.card, { width, height }, dark ? styles.glass : { backgroundColor: look.background }]}
      >
        <Text style={[styles.name, { color: text, height: nameArea, paddingTop: 8 * k, paddingHorizontal: 8 * k, fontSize: 15 * k, lineHeight: 20 * k }]}
          numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1}>{name}</Text>
        <View pointerEvents="none" style={[styles.gloss, dark && styles.glossDark]} />
        <View style={styles.art} pointerEvents="none">
          <Animated.View style={[styles.ground, { width: width * 0.5, height: 7 * k, borderRadius: 4 * k, bottom: 2 * k }, ground]} />
          <Animated.View style={tilt}>
            <Art width={width} height={height - nameArea - captionArea} />
          </Animated.View>
        </View>
        <Text style={[styles.caption, { color: text, height: captionArea, paddingHorizontal: 8 * k, paddingTop: 2 * k, fontSize: 8 * k, lineHeight: 10 * k }]}
          numberOfLines={2} maxFontSizeMultiplier={1}>{look.caption}</Text>
      </Tap>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  // dark:bg-white/[0.03] dark:border-white/10 on the website
  glass: { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  name: { fontWeight: '800', letterSpacing: -0.3 },
  art: { flex: 1, alignItems: 'center' },
  ground: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.12)' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'linear-gradient(150deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 45%)' },
  glossDark: { backgroundImage: 'linear-gradient(150deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 45%)' },
  caption: {
    textAlign: 'center', fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', opacity: 0.75,
  },
});
