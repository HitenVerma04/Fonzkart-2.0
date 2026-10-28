// Catalog pictures and picture tiles. A picture shows a skeleton until it has loaded, then fades in; without one
// (or when it fails) the item's initial is shown on a green tint.
import { useState, type ReactNode } from 'react';
import { Image, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { imageUrl } from '@fonzkart/core';
import { makeStyles } from '@fonzkart/ui';
import { Skeleton } from './Skeleton';
import { Tap } from './Tap';
import { radii, type } from './tokens';

export function ProductImage({ uri, label, size }: { uri: string | null | undefined; label: string; size: number }) {
  const styles = useStyles();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const opacity = useSharedValue(0);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const url = imageUrl(uri);

  if (!url || failed) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 4 }]} accessibilityLabel={label}>
        <Text style={[styles.initial, { fontSize: size / 2.6 }]}>{label.trim().charAt(0).toUpperCase() || '?'}</Text>
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size }}>
      {!loaded ? <Skeleton width={size} height={size} radius={size / 5} style={styles.under} /> : null}
      <Animated.View style={fade}>
        <Image
          source={{ uri: url }}
          style={{ width: size, height: size }}
          resizeMode="contain"
          onLoad={() => {
            setLoaded(true);
            opacity.value = withTiming(1, { duration: 280 });
          }}
          onError={() => setFailed(true)}
          accessibilityLabel={label}
        />
      </Animated.View>
    </View>
  );
}

/** A picture card with a label (brands, models). */
export function Tile({ label, caption, image, onPress, width }: {
  label: string;
  caption?: string;
  image: ReactNode;
  onPress: () => void;
  width: number;
}) {
  const styles = useStyles();
  return (
    <Tap onPress={onPress} scaleTo={0.95} accessibilityRole="button" accessibilityLabel={label}
      style={[styles.tile, { width }]}>
      <View style={styles.well}>{image}</View>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
      {caption ? <Text style={styles.caption} numberOfLines={1}>{caption}</Text> : null}
    </Tap>
  );
}

const useStyles = makeStyles(colors => ({
  fallback: { backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.greenDark, fontWeight: '800' },
  under: { position: 'absolute' },
  tile: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: 8, alignItems: 'center', gap: 8 },
  well: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, borderRadius: radii.sm, paddingVertical: 8 },
  label: { ...type.small, fontWeight: '700', color: colors.text, textAlign: 'center', paddingHorizontal: 2, paddingBottom: 4 },
  caption: { ...type.small, fontSize: 11, color: colors.green, fontWeight: '700', textAlign: 'center' },
}));
