// Buttons: the primary one is a green gradient pill with a soft green glow; "secondary" is tonal green, "outline" a
// neutral pill, "link" plain green text and "danger" red text (only for deleting an account). While busy, three dots
// bounce in place of the label.
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { makeStyles, useColors } from '@fonzkart/ui';
import { Icon, type IconName } from './Icon';
import { Tap } from './Tap';
import { radii, systemFill, type, useDesign } from './tokens';

type Variant = 'primary' | 'secondary' | 'outline' | 'link' | 'danger';

export function Button({ title, onPress, variant = 'primary', size = 'lg', icon, disabled, loading }: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
}) {
  const colors = useColors();
  const d = useDesign();
  const styles = useStyles();
  const inactive = disabled || loading;
  const textColor = {
    primary: d.onGreen,
    secondary: colors.greenDark,
    outline: colors.text,
    link: colors.green,
    danger: colors.danger,
  }[variant];
  const frame = {
    // Apple's button styles: filled (solid tint), tinted (light tint), gray (system fill); no gradients or glow.
    primary: { backgroundColor: colors.green },
    secondary: { backgroundColor: colors.greenTint },
    outline: { backgroundColor: d.scheme === 'dark' ? systemFill.dark : systemFill.light },
    link: {},
    danger: {},
  }[variant];
  const height = variant === 'link' || variant === 'danger' ? 44 : { lg: 50, md: 44, sm: 34 }[size];

  return (
    <Tap
      onPress={onPress}
      disabled={inactive}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[styles.base, { minHeight: height }, frame, disabled && !loading && styles.disabled, size === 'sm' && styles.small]}
    >
      {loading ? (
        <LoadingDots color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} color={textColor} size={size === 'sm' ? 16 : 20} /> : null}
          <Text style={[styles.text, size === 'sm' && styles.textSmall, { color: textColor }]} numberOfLines={1}>{title}</Text>
        </View>
      )}
    </Tap>
  );
}

/** Three dots bouncing one after another: the app's "working on it". */
export function LoadingDots({ color, size = 7 }: { color: string; size?: number }) {
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  const c = useSharedValue(0);
  useEffect(() => {
    [a, b, c].forEach((v, i) => {
      v.value = withDelay(i * 130, withRepeat(withSequence(withTiming(1, { duration: 280 }), withTiming(0, { duration: 280 }), withTiming(0, { duration: 260 })), -1, false));
    });
  }, [a, b, c]);
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.7, alignItems: 'center', height: size * 3 }} accessibilityLabel="Loading">
      <Dot value={a} color={color} size={size} />
      <Dot value={b} color={color} size={size} />
      <Dot value={c} color={color} size={size} />
    </View>
  );
}

function Dot({ value, color, size }: { value: SharedValue<number>; color: string; size: number }) {
  const style = useAnimatedStyle(() => ({ opacity: 0.4 + value.value * 0.6, transform: [{ translateY: -value.value * size * 0.8 }] }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

const useStyles = makeStyles(() => ({
  base: { borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  small: { paddingHorizontal: 14 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disabled: { opacity: 0.42 },
  text: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.4 },
  textSmall: { fontSize: 15, lineHeight: 20, letterSpacing: -0.2 },
}));
