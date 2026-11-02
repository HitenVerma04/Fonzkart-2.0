// The website's framer-motion loops (components/sell/CategorySelector.tsx), on the UI thread with Reanimated.
import { createContext, useContext, useEffect, useState } from 'react';
import {
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

// framer-motion's "easeInOut".
const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);

/**
 * Whether a drawing's inner parts may move. The home screen turns this off only while nobody can see the drawings
 * (another screen covers it, or the cards are scrolled off screen). Drawings outside a provider always move.
 */
const ALWAYS = makeMutable(true);
export const ArtActivity = createContext<SharedValue<boolean>>(ALWAYS);

/**
 * Whether whole-view motions (a drawing floating, a card tilting) may run: same rule as ArtActivity on the home
 * screen. Elsewhere they always run.
 */
export const MotionActivity = createContext<SharedValue<boolean>>(ALWAYS);

/**
 * The colour behind a drawing (its card). Each drawing paints it first instead of relying on a transparent canvas: on
 * Android a transparent Skia surface inside a tilted, clipped card can composite as black.
 */
export const ArtBackground = createContext<string | null>(null);

/**
 * 0 → 1 → 0 every `seconds`, forever: a framer-motion keyframe loop [a, b, a]. `delay` only holds the first run.
 * `scope` 'detail' (a drawing's inner parts) follows ArtActivity; 'motion' (the whole drawing or card moving as a
 * finished picture) follows MotionActivity.
 */
export function useLoop(seconds: number, delay = 0, scope: 'detail' | 'motion' = 'detail'): SharedValue<number> {
  const t = useSharedValue(0);
  const detail = useContext(ArtActivity);
  const motion = useContext(MotionActivity);
  const active = scope === 'motion' ? motion : detail;
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
