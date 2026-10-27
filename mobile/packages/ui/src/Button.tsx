import { ActivityIndicator, Pressable, Text } from 'react-native';
import { makeStyles, useColors } from './ThemeContext';
import { font, radius, spacing } from './theme';

export function Button({ title, onPress, variant = 'primary', disabled, loading }: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'link';
  disabled?: boolean;
  loading?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const pressedStyles = usePressedStyles();
  const textStyles = useTextStyles();
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && pressedStyles[variant],
        inactive && variant !== 'link' && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.green} />
      ) : (
        <Text style={[styles.text, textStyles[variant], inactive && variant === 'link' && { color: colors.muted }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles(colors => ({
  base: { minHeight: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  primary: { backgroundColor: colors.green },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  link: { minHeight: 40, paddingHorizontal: spacing.sm },
  disabled: { opacity: 0.45 },
  text: { fontSize: font.body, fontWeight: '700' },
}));

const usePressedStyles = makeStyles(colors => ({
  primary: { backgroundColor: colors.greenPressed },
  secondary: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  link: { opacity: 0.6 },
}));

const useTextStyles = makeStyles(colors => ({
  primary: { color: colors.white },
  secondary: { color: colors.navy },
  link: { color: colors.green },
}));
