import { StyleSheet, Text, View } from 'react-native';
import { useColors } from './ThemeContext';
import { font, radius, spacing, type Palette } from './theme';

type Tone = 'info' | 'success' | 'error';

const toneColors = (colors: Palette, tone: Tone) =>
  tone === 'success' ? { background: colors.greenSoft, border: colors.greenBorder, text: colors.greenDark } : colors[tone];

export function Notice({ text, tone = 'info' }: { text: string; tone?: Tone }) {
  const t = toneColors(useColors(), tone);
  return (
    <View
      style={[styles.box, { backgroundColor: t.background, borderColor: t.border }]}
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.text, { color: t.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  text: { fontSize: font.small, fontWeight: '600', lineHeight: 19 },
});
