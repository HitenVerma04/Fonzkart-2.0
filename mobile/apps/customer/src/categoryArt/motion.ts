// The website's framer-motion loops (components/sell/CategorySelector.tsx), on the UI thread with Reanimated.
import { useEffect } from 'react';
import { Circle, G, Line, Path, Rect } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export const AnimatedG = Animated.createAnimatedComponent(G);
export const AnimatedPath = Animated.createAnimatedComponent(Path);
export const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export const AnimatedRect = Animated.createAnimatedComponent(Rect);
export const AnimatedLine = Animated.createAnimatedComponent(Line);

// framer-motion's "easeInOut".
const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);

/** 0 → 1 → 0 every `seconds`, forever: a framer-motion keyframe loop [a, b, a]. `delay` only holds the first run. */
export function useLoop(seconds: number, delay = 0): SharedValue<number> {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay * 1000, withRepeat(withTiming(1, { duration: seconds * 500, easing: easeInOut }), -1, true));
    return () => cancelAnimation(t);
  }, [t, seconds, delay]);
  return t;
}

/** 0 → 1 every `seconds` at a steady speed, restarting: one full turn of `rotate: 360`. */
export function useSpin(seconds: number): SharedValue<number> {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: seconds * 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [t, seconds]);
  return t;
}

export function lerp(from: number, to: number, t: number) {
  'worklet';
  return from + (to - from) * t;
}

/**
 * The SVG matrix (react-native-svg's native `matrix` prop) for "rotate by `degrees` around (ox, oy), then move down
 * by `dy`", which is what framer-motion does with `rotate` and `y` on an SVG element.
 */
export function rotateAbout(degrees: number, ox: number, oy: number, dy = 0): number[] {
  'worklet';
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, ox - c * ox + s * oy, oy + dy - s * ox - c * oy];
}

export function moveDown(dy: number): number[] {
  'worklet';
  return [1, 0, 0, 1, 0, dy];
}
