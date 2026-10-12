import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from './theme';

/** A tappable card with a picture above a label (categories, brands, models). */
export function Tile({ label, caption, image, onPress, width }: {
  label: string;
  caption?: string;
  image: ReactNode;
  onPress: () => void;
  width: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, { width }, pressed && styles.pressed]}
    >
      <View style={styles.image}>{image}</View>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
      {caption ? <Text style={styles.caption} numberOfLines={1}>{caption}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
  },
  pressed: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  image: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  label: { fontSize: font.small, fontWeight: '600', color: colors.text, textAlign: 'center' },
  caption: { fontSize: font.tiny, color: colors.green, fontWeight: '600', marginTop: 2, textAlign: 'center' },
});
