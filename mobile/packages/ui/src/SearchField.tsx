import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, font, radius, spacing } from './theme';

export function SearchField(props: TextInputProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">⌕</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        {...props}
        style={[styles.input, props.style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  icon: { fontSize: 20, color: colors.muted, marginRight: spacing.sm },
  input: { flex: 1, fontSize: font.body, color: colors.text, paddingVertical: spacing.sm },
});
