// Skeleton placeholders: grey shapes where content will appear, with a light band sweeping across. Every block on
// screen shares one clock, so the sweep moves across them together.
import { useEffect, useState, type ReactNode } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, makeMutable, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { makeStyles, useColors } from '@fonzkart/ui';
import { MAX_CONTENT, radii, useDesign } from './tokens';

const clock = makeMutable(0);
let running = false;
function startClock() {
  if (running) return;
  running = true;
  clock.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
}

export function Skeleton({ width = '100%', height, radius = radii.sm, style }: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const d = useDesign();
  const [w, setW] = useState(0);
  useEffect(startClock, []);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: -w + clock.value * w * 2 }] }));
  return (
    <View
      onLayout={e => setW(e.nativeEvent.layout.width)}
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.placeholder, overflow: 'hidden' }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {w ? (
        <Animated.View
          style={[
            { position: 'absolute', top: 0, bottom: 0, width: w, backgroundImage: `linear-gradient(90deg, transparent 0%, ${d.shimmer} 50%, transparent 100%)` },
            sweep,
          ]}
        />
      ) : null}
    </View>
  );
}

/** Wraps a skeleton layout: announced once to screen readers as loading. */
export function SkeletonScreen({ children, label = 'Loading', style }: { children: ReactNode; label?: string; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.screen, style]} accessible accessibilityLabel={label} accessibilityRole="progressbar">
      {children}
    </View>
  );
}

/** A grid of picture tiles (brands, models). */
export function SkeletonTiles({ count, width, imageHeight }: { count: number; width: number; imageHeight: number }) {
  const styles = useStyles();
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.tile, { width }]}>
          <Skeleton height={imageHeight} radius={radii.sm} />
          <Skeleton width="70%" height={12} style={styles.center} />
        </View>
      ))}
    </View>
  );
}

/** Rows with a picture, two lines and a value (search results, variants, notifications, orders). */
export function SkeletonRows({ count = 5, image = 52, trailing }: { count?: number; image?: number; trailing?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.rows}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row}>
          {image ? <Skeleton width={image} height={image} radius={radii.sm} /> : null}
          <View style={styles.rowText}>
            <Skeleton width="75%" height={14} />
            <Skeleton width="45%" height={11} />
          </View>
          {trailing ? <Skeleton width={56} height={18} /> : null}
        </View>
      ))}
    </View>
  );
}

/** A card with a title and a few lines (order details, profile). */
export function SkeletonCard({ lines = 3, tall }: { lines?: number; tall?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Skeleton width="40%" height={16} />
      {tall ? <Skeleton height={36} width="55%" /> : null}
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} height={12} />)}
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  screen: { gap: 16, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { backgroundColor: colors.surface, borderRadius: radii.md, padding: 10, gap: 10, borderWidth: 1, borderColor: colors.border },
  center: { alignSelf: 'center' },
  rows: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: colors.border },
  rowText: { flex: 1, gap: 8 },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: 18, gap: 12, borderWidth: 1, borderColor: colors.border },
}));
