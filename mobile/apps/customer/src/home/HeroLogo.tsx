// The home header's brand lockup: the green Fonzkart "F" (mobile/brand/), "Fonzkart" and "Buy • Sell • Repair •
// Refurbish". Once the launch animation has finished, the F springs in with a little twist and the name slides in after
// it; then a soft green glow breathes behind the F and it gives a small nod every few seconds. With "reduce motion" on
// it just shows. `onDark` is for the dark header (and the festive ones): white text instead of the navy wordmark.
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, Extrapolation, interpolate, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { launchCovering } from '../launchTargets';

const F_MARK = require('../../../../brand/fonzkart_f_mark.png');
const F_RATIO = 450 / 675;
const TAGLINE = ['Buy', 'Sell', 'Repair', 'Refurbish'];

export function HeroLogo({ onDark, accent = '#22c55e' }: { onDark: boolean; accent?: string }) {
  const reduce = useReducedMotion();
  const enter = useSharedValue(reduce ? 1 : 0);
  const nod = useSharedValue(0);
  const glow = useSharedValue(0);

  // Starts once nothing covers the home screen any more (right away if the launch animation is already over).
  useAnimatedReaction(() => launchCovering.value, covering => {
    if (covering || reduce || enter.value > 0) return;
    enter.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.back(1.6)) });
    glow.value = withDelay(900, withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true));
    nod.value = withDelay(2200, withRepeat(withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
      withTiming(-0.5, { duration: 220, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 4200 }),
    ), -1, false));
  }, [reduce]);
  useEffect(() => () => {
    cancelAnimation(enter);
    cancelAnimation(nod);
    cancelAnimation(glow);
  }, [enter, nod, glow]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.25], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(enter.value, [0, 1], [0.4, 1]) },
      { rotate: `${interpolate(enter.value, [0, 1], [-18, 0]) + nod.value * -8}deg` },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0.6, 1], [0, 1], Extrapolation.CLAMP) * interpolate(glow.value, [0, 1], [0.35, 0.8]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.85, 1.15]) }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0.35, 0.9], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(enter.value, [0.35, 0.9], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const nameColor = onDark ? '#ffffff' : '#0b1f14';
  const taglineColor = onDark ? 'rgba(255,255,255,0.72)' : '#4b5563';
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Fonzkart: buy, sell, repair, refurbish">
      <View style={styles.markBox}>
        <Animated.View style={[styles.glow, glowStyle]} />
        <Animated.View style={[{ transformOrigin: 'center bottom' }, markStyle]}>
          <Image source={F_MARK} style={styles.mark} resizeMode="contain" />
        </Animated.View>
      </View>
      <Animated.View style={[styles.text, textStyle]}>
        <Text style={[styles.name, { color: nameColor }]} numberOfLines={1}>Fonzkart</Text>
        <Text style={[styles.tagline, { color: taglineColor }]} numberOfLines={1}>
          {TAGLINE.map((word, i) => (
            <Text key={word}>{i ? <Text style={{ color: accent }}>{'  •  '}</Text> : null}{word}</Text>
          ))}
        </Text>
      </Animated.View>
    </View>
  );
}

const MARK_HEIGHT = 40;
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 },
  markBox: { width: Math.round(MARK_HEIGHT * F_RATIO) + 6, height: MARK_HEIGHT + 4, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute', width: 56, height: 56, borderRadius: 28,
    backgroundImage: 'radial-gradient(circle, rgba(34,197,94,0.55) 0%, rgba(34,197,94,0.18) 45%, rgba(34,197,94,0) 70%)',
  },
  mark: { width: Math.round(MARK_HEIGHT * F_RATIO), height: MARK_HEIGHT },
  text: { flexShrink: 1, minWidth: 0 },
  name: { fontSize: 26, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6 },
  tagline: { fontSize: 12, lineHeight: 15, fontWeight: '600', letterSpacing: 0.1 },
});
