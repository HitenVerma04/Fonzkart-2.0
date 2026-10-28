// A home-screen category card like the website's (components/sell/CategorySelector.tsx), in Fonzkart greens: tinted card in light mode, the
// website's glassy card and light text in dark mode; name, the animated drawing, and the small caption under it. Cards
// fade and grow in one after another.
import { StyleSheet, Text, View } from 'react-native';
import Animated, { withDelay, withTiming } from 'react-native-reanimated';
import { radius, spacing, useTheme } from '@fonzkart/ui';
import { Tap, useDesign } from '../design';
import { CATEGORY_ART, type HomeTileId } from './graphics';

const CARD_RATIO = 1.4;
const NAME_AREA = spacing.sm + 20; // padding above the name, and the name
const CAPTION_AREA = 28; // two caption lines and the space under them

const LOOK: Record<HomeTileId, { background: string; text: string; darkText: string; caption: string }> = {
  smartphone: { background: '#f0fdf4', text: '#14532d', darkText: '#bbf7d0', caption: 'Instant cash for your phone' },
  tablet: { background: '#ecfdf5', text: '#064e3b', darkText: '#a7f3d0', caption: 'Instant cash for your tablet' },
  camera: { background: '#f0fdf4', text: '#14532d', darkText: '#bbf7d0', caption: 'Premium value for your gear' },
  laptop: { background: '#ecfdf5', text: '#064e3b', darkText: '#a7f3d0', caption: 'Upgrade today, highest payouts' },
  watch: { background: '#f0fdf4', text: '#14532d', darkText: '#bbf7d0', caption: 'Top market prices guaranteed' },
  smarttv: { background: '#ecfdf5', text: '#064e3b', darkText: '#a7f3d0', caption: 'Best value for your television' },
  console: { background: '#f0fdf4', text: '#14532d', darkText: '#bbf7d0', caption: 'Instant cash for your console' },
  desktop: { background: '#ecfdf5', text: '#064e3b', darkText: '#a7f3d0', caption: 'Turn your old PC into cash' },
  earbuds: { background: '#f0fdf4', text: '#14532d', darkText: '#bbf7d0', caption: 'Instant quote and fast money' },
  repair: { background: '#ecfdf5', text: '#064e3b', darkText: '#a7f3d0', caption: 'Quick, reliable, affordable' },
  screenguard: { background: '#f0fdf4', text: '#14532d', darkText: '#bbf7d0', caption: 'Unbreakable • 3-hr doorstep' },
  bulk: { background: '#ecfdf5', text: '#064e3b', darkText: '#a7f3d0', caption: 'Corporate & recycling' },
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
  const d = useDesign();
  const height = Math.round(width * CARD_RATIO);
  return (
    <Animated.View entering={appear(index)}>
      <Tap
        onPress={onPress}
        scaleTo={0.94}
        accessibilityRole="button"
        accessibilityLabel={name}
        style={[styles.card, { width, height, boxShadow: d.shadow.sm }, dark ? styles.glass : { backgroundColor: look.background, borderWidth: 1, borderColor: '#dcfce7' }]}
      >
        <Text style={[styles.name, { color: text }]} numberOfLines={1} adjustsFontSizeToFit>{name}</Text>
        <View style={styles.art} pointerEvents="none">
          <Art width={width} height={height - NAME_AREA - CAPTION_AREA} />
        </View>
        <Text style={[styles.caption, { color: text }]} numberOfLines={2}>{look.caption}</Text>
      </Tap>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  // dark:bg-white/[0.03] dark:border-white/10 on the website
  glass: { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  name: { height: NAME_AREA, paddingTop: spacing.sm, paddingHorizontal: spacing.sm, fontSize: 15, lineHeight: 20, fontWeight: '800', letterSpacing: -0.3 },
  art: { flex: 1 },
  caption: {
    height: CAPTION_AREA, paddingHorizontal: spacing.sm, paddingTop: 2, textAlign: 'center',
    fontSize: 8, lineHeight: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', opacity: 0.75,
  },
});
