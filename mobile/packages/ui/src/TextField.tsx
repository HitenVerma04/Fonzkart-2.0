import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { makeStyles, useColors } from './ThemeContext';
import { font, radius, spacing } from './theme';

/**
 * A labelled text box. `error` (from the @fonzkart/core checks: phoneProblem, emailProblem, …) is shown in red under
 * the box once the person leaves the field, or at once with `showError` (set it after a submit with mistakes), so
 * nobody is told off for a number they are still typing. A field that was wrong and is now right turns green.
 */
export function TextField({ label, prefix, hint, error, showError, onBlur, ...input }: TextInputProps & {
  label: string;
  prefix?: string;
  hint?: string;
  /** What is wrong with the value, or null/undefined when it is fine. */
  error?: string | null;
  /** Show the error even before the field was left (after the person pressed the button). */
  showError?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [left, setLeft] = useState(false);
  const [wasWrong, setWasWrong] = useState(false);
  const visibleError = error && (left || showError) ? error : null;
  if (visibleError && !wasWrong) setWasWrong(true);
  const fixed = wasWrong && !error && !!input.value;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, visibleError ? styles.boxError : fixed ? styles.boxOk : null]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          accessibilityHint={visibleError ?? undefined}
          aria-invalid={!!visibleError}
          {...input}
          onBlur={e => {
            setLeft(true);
            onBlur?.(e);
          }}
          style={[styles.input, input.style]}
        />
        {fixed ? <Text style={styles.ok} accessibilityLabel="Looks good">✓</Text> : null}
      </View>
      {visibleError ? (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">⚠ {visibleError}</Text>
      ) : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles(colors => ({
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
  boxError: { borderColor: colors.danger, borderWidth: 1.5 },
  boxOk: { borderColor: colors.green },
  prefix: { fontSize: font.body, color: colors.muted, marginRight: spacing.sm },
  input: { flex: 1, fontSize: font.body, color: colors.text, paddingVertical: spacing.sm },
  ok: { fontSize: font.body, fontWeight: '800', color: colors.green, marginLeft: spacing.sm },
  hint: { fontSize: font.tiny, color: colors.muted },
  error: { fontSize: font.small, fontWeight: '600', color: colors.danger },
}));
