import { useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { imageUrl } from '@fonzkart/core';
import { colors } from './theme';

/** A catalog picture (website path or URL). Shows the item's initial while loading fails or when there is none. */
export function RemoteImage({ uri, label, size, style }: {
  uri: string | null | undefined;
  label: string;
  size: number;
  style?: StyleProp<ImageStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const url = imageUrl(uri);
  if (!url || failed) {
    return (
      <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 6 }]}>
        <Text style={[styles.initial, { fontSize: size / 2.6 }]}>{label.trim().charAt(0).toUpperCase() || '?'}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      onError={() => setFailed(true)}
      accessibilityLabel={label}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.placeholder, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.muted, fontWeight: '700' },
});
