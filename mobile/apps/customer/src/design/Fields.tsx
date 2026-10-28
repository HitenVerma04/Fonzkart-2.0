// Text input and search bar. A focused field gets a green edge and a soft green ring.
import { useEffect, useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { makeStyles, useColors } from '@fonzkart/ui';
import { Glass } from './Glass';
import { Icon } from './Icon';
import { Tap } from './Tap';
import { radii, type } from './tokens';

export function TextField({ label, prefix, hint, onFocus, onBlur, ...input }: TextInputProps & { label: string; prefix?: string; hint?: string }) {
  const colors = useColors();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, focused && { color: colors.green }]}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused, input.multiline && styles.boxMultiline]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={colors.muted}
          selectionColor={colors.green}
          cursorColor={colors.green}
          accessibilityLabel={label}
          onFocus={e => { setFocused(true); onFocus?.(e); }}
          onBlur={e => { setFocused(false); onBlur?.(e); }}
          {...input}
          style={[styles.input, input.style]}
        />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/**
 * The search bar. With `onPress` it is a button that opens the search screen, and its placeholder cycles through
 * `suggestions` ("Search “iPhone 13”"); otherwise it is the live input.
 */
export function SearchBar({ onPress, suggestions, glass, ...input }: TextInputProps & {
  onPress?: () => void;
  suggestions?: string[];
  glass?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!onPress || !suggestions?.length) return undefined;
    const timer = setInterval(() => setIndex(i => (i + 1) % suggestions.length), 2400);
    return () => clearInterval(timer);
  }, [onPress, suggestions]);

  const inner = (
    <>
      <Icon name="search" color={colors.green} size={20} />
      {onPress ? (
        <View style={styles.rotating}>
          <Text style={styles.placeholder}>Search </Text>
          {suggestions?.length ? (
            <Animated.Text key={index} entering={FadeInDown.duration(260)} exiting={FadeOutUp.duration(200)} style={styles.placeholder} numberOfLines={1}>
              “{suggestions[index]}”
            </Animated.Text>
          ) : (
            <Text style={styles.placeholder}>{input.placeholder}</Text>
          )}
        </View>
      ) : (
        <TextInput
          placeholderTextColor={colors.muted}
          selectionColor={colors.green}
          cursorColor={colors.green}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel={input.placeholder ?? 'Search'}
          {...input}
          style={[styles.searchInput, input.style]}
        />
      )}
      {!onPress && input.value ? (
        <Tap onPress={() => input.onChangeText?.('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clear}>
          <Icon name="close" color={colors.muted} size={16} strokeWidth={2.4} />
        </Tap>
      ) : null}
    </>
  );

  const bar = glass ? (
    <Glass strong radius={radii.pill} shadow="md" style={styles.search}>{inner}</Glass>
  ) : (
    <View style={[styles.search, styles.searchPlain]}>{inner}</View>
  );
  if (!onPress) return bar;
  return (
    <Tap onPress={onPress} scaleTo={0.98} accessibilityRole="search" accessibilityLabel={input.placeholder ?? 'Search'}>
      <View pointerEvents="none">{bar}</View>
    </Tap>
  );
}

const useStyles = makeStyles(colors => ({
  field: { gap: 6 },
  label: { ...type.small, fontWeight: '600', color: colors.textSoft },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  boxFocused: { borderColor: colors.green, boxShadow: `0px 0px 0px 4px ${colors.ripple}` },
  boxMultiline: { alignItems: 'flex-start', paddingVertical: 4 },
  prefix: { ...type.body, fontWeight: '600', color: colors.muted, marginRight: 8 },
  input: { flex: 1, ...type.body, color: colors.text, paddingVertical: 10 },
  hint: { ...type.small, fontSize: 12, color: colors.muted },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 18 },
  searchPlain: { backgroundColor: colors.surface, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.border },
  rotating: { flex: 1, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', height: 22 },
  placeholder: { ...type.body, color: colors.muted },
  searchInput: { flex: 1, ...type.body, color: colors.text, paddingVertical: 12 },
  clear: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.placeholder, alignItems: 'center', justifyContent: 'center' },
}));
