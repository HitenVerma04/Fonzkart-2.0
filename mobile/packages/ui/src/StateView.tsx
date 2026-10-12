import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from './theme';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.green} size="large" />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message = 'Could not reach Fonzkart. Check your internet connection.', onRetry }: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.text}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm, minHeight: 200 },
  title: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  text: { fontSize: font.body, color: colors.muted, textAlign: 'center' },
  button: { marginTop: spacing.sm, backgroundColor: colors.green, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  pressed: { backgroundColor: colors.greenDark },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: font.body },
});
