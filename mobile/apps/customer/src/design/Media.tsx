// Catalog pictures and picture tiles. A picture is always shown as soon as it arrives; under it, a placeholder shaped
// like the device (or a logo) stands in until it has loaded (at most a few seconds). The picture is never hidden while
// waiting for a "loaded" signal: when that signal did not come, pictures stayed invisible. Without one
// (or when it fails) the item's initial is shown on a green tint.
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Text, View } from 'react-native';
import { imageUrl } from '@fonzkart/core';
import { makeStyles, useTheme } from '@fonzkart/ui';
import { DeviceSkeleton, type DeviceKind } from './DeviceSkeleton';
import { Tap } from './Tap';
import { radii, type } from './tokens';

/** How long the loading placeholder may stay under a picture. */
const PLACEHOLDER_MAX_MS = 4000;

export function ProductImage({ uri, label, size, kind = 'phone' }: {
  uri: string | null | undefined;
  label: string;
  size: number;
  /** The placeholder's shape while loading: the device type, or 'logo' for brand logos. */
  kind?: DeviceKind;
}) {
  const styles = useStyles();
  const dark = useTheme().scheme === 'dark';
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const url = imageUrl(uri);
  // The placeholder goes when the picture has loaded, or after a few seconds in any case.
  useEffect(() => {
    setLoaded(false);
    const timer = setTimeout(() => setLoaded(true), PLACEHOLDER_MAX_MS);
    return () => clearTimeout(timer);
  }, [url]);

  if (!url || failed) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 4 }]} accessibilityLabel={label}>
        <Text style={[styles.initial, { fontSize: size / 2.6 }]}>{label.trim().charAt(0).toUpperCase() || '?'}</Text>
      </View>
    );
  }
  // In dark mode the picture sits on a light card: many brand logos and product shots are black on transparent.
  const inner = dark ? Math.round(size * 0.84) : size;
  return (
    <View style={[{ width: size, height: size }, dark && styles.lightBackdrop]}>
      {!loaded ? <View style={styles.under}><DeviceSkeleton kind={kind} size={inner} /></View> : null}
      <Image
          source={{ uri: url }}
          style={{ width: inner, height: inner }}
          resizeMode="contain"
          fadeDuration={250}
          onLoad={() => setLoaded(true)}
          onLoadEnd={() => setLoaded(true)}
          onError={() => setFailed(true)}
          accessibilityLabel={label}
      />
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
  lightBackdrop: { backgroundColor: '#f4f7f5', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tile: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: 8, alignItems: 'center', gap: 8 },
  well: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, borderRadius: radii.sm, paddingVertical: 8 },
  label: { ...type.small, fontWeight: '700', color: colors.text, textAlign: 'center', paddingHorizontal: 2, paddingBottom: 4 },
  caption: { ...type.small, fontSize: 11, color: colors.green, fontWeight: '700', textAlign: 'center' },
}));
