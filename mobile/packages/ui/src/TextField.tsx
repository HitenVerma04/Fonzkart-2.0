import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, font, radius, spacing } from './theme';

export function TextField({ label, prefix, hint, ...input }: TextInputProps & { label: string; prefix?: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.box}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          {...input}
          style={[styles.input, input.style]}
        />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontSize: font.small, fontWeight: '600', color: colors.textSoft },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 50,
  },
  prefix: { fontSize: font.body, color: colors.muted, marginRight: spacing.sm },
  input: { flex: 1, fontSize: font.body, color: colors.text, paddingVertical: spacing.sm },
  hint: { fontSize: font.tiny, color: colors.muted },
});
