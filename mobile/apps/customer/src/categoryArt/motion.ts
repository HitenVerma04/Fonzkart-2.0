// The website's framer-motion loops (components/sell/CategorySelector.tsx), on the UI thread with Reanimated.
import { createContext, useContext, useEffect, useState } from 'react';
import { Circle, G, Line, Path, Rect } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  makeMutable,
  useAnimatedReaction,
  useSharedValue,
  runOnJS,
  withSequence,
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

/**
 * Whether a drawing's inner parts may move (each frame of those redraws the whole SVG, which is costly). The home
 * screen gives each card its own switch: on for the one card in the spotlight, off for the rest, and off for all
 * while the list scrolls or another screen covers it. Drawings outside a provider (the Bulk orders page) always move.
 */
const ALWAYS = makeMutable(true);
export const ArtActivity = createContext<SharedValue<boolean>>(ALWAYS);

/**
 * Which home card plays its full animation right now (the others float and tilt as still pictures). null: every card
 * does, for a card shown outside the home screen.
 */
export const Spotlight = createContext<SharedValue<string | null>>(makeMutable<string | null>(null));

/**
 * 0 → 1 → 0 every `seconds`, forever: a framer-motion keyframe loop [a, b, a]. `delay` only holds the first run.
 * With `pausable` false it ignores ArtActivity: for whole-view motions (a drawing floating, a card tilting), which
 * the phone's graphics chip moves as a finished picture at almost no cost.
 */
export function useLoop(seconds: number, delay = 0, pausable = true): SharedValue<number> {
  const t = useSharedValue(0);
  const context = useContext(ArtActivity);
  const active = pausable ? context : ALWAYS;
  const half = seconds * 500;
  useEffect(() => {
    if (active.value) t.value = withDelay(delay * 1000, withRepeat(withTiming(1, { duration: half, easing: easeInOut }), -1, true));
    return () => cancelAnimation(t);
  }, [t, half, delay, active]);
  // Pause where it is; resume from there towards the nearer end, then loop as before.
  useAnimatedReaction(() => active.value, (running, previous) => {
    if (previous === null || running === previous) return;
    if (!running) cancelAnimation(t);
    else t.value = withRepeat(withTiming(t.value < 0.5 ? 1 : 0, { duration: half, easing: easeInOut }), -1, true);
  }, [half]);
  return t;
}

/** True while this drawing is paused: it can then be kept as a ready-drawn picture (see Canvas). */
export function useArtStill(): boolean {
  const active = useContext(ArtActivity);
  const [still, setStill] = useState(!active.value);
  useAnimatedReaction(() => active.value, (running, previous) => {
    if (running !== previous) runOnJS(setStill)(!running);
  });
  return still;
}

/** 0 → 1 every `seconds` at a steady speed, restarting: one full turn of `rotate: 360`. */
export function useSpin(seconds: number): SharedValue<number> {
  const t = useSharedValue(0);
  const active = useContext(ArtActivity);
  const turn = seconds * 1000;
  useEffect(() => {
    if (active.value) t.value = withRepeat(withTiming(1, { duration: turn, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [t, turn, active]);
  useAnimatedReaction(() => active.value, (running, previous) => {
    if (previous === null || running === previous) return;
    if (!running) cancelAnimation(t);
    else {
      t.value = withSequence(
        withTiming(1, { duration: (1 - t.value) * turn, easing: Easing.linear }),
        withTiming(0, { duration: 0 }),
        withRepeat(withTiming(1, { duration: turn, easing: Easing.linear }), -1, false),
      );
    }
  }, [turn]);
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
