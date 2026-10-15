import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from './theme';

const TONES = {
  info: { background: '#eff6ff', border: '#bfdbfe', text: '#1e3a8a' },
  success: { background: colors.greenSoft, border: '#bbf7d0', text: colors.greenDark },
  error: { background: '#fef2f2', border: '#fecaca', text: '#991b1b' },
};

export function Notice({ text, tone = 'info' }: { text: string; tone?: keyof typeof TONES }) {
  const t = TONES[tone];
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
