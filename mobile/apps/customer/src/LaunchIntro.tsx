// The launch animation, played once per app start over the first screen. On a themed sky of drifting aurora lights,
// rising stardust and floating devices, the F logo appears with a burst of light and the ONZKA₹T lettering is unveiled
// under it, while Fonzkart's services (Buy, Sell, Repair, Screen Guard, Refurbish) spiral out and circle them in 3D. When
// the app has loaded, the sky fades away and each icon flies to its real button with a trail of stardust, landing with
// a ripple: Sell, Buy and Repair on the tab bar (Refurbish with Buy), Screen Guard on its card further down home.
//
// Smoothness rules, as this is the app's first impression: only transforms and opacity animate (never width, zIndex or
// shadows, which redo layout or repainting every frame); one clock (`angle`) drives everything that loops; groups of
// sparks move as one view; moving tiles are kept as ready-drawn layers, so their text does not shimmer as they scale;
// the home screen's drawings wait (launchCovering); and nothing starts until the first screen has been mounted.
import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { useIsFetching } from '@tanstack/react-query';
import { useColors, useTheme } from '@fonzkart/ui';
import { festiveGreeting, Icon, type IconName, useDesign } from './design';
import { launchCovering, measureLaunchTarget } from './launchTargets';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const MARK = require('../../../brand/fonzkart_f_mark.png');
const MARK_RATIO = 450 / 675; // the F's width / height
const WORDMARK = require('../../../brand/fonzkart_wordmark.png');
const WORDMARK_DARK = require('../../../brand/fonzkart_wordmark_dark.png');
const RATIO = 1408 / 346; // wordmark width / height
const PHONE = 190 / 1408; // share of the wordmark's width taken by the F-phone

const SERVICES: { id: string; label: string; icon: IconName; target: string }[] = [
  { id: 'buy', label: 'Buy', icon: 'buy', target: 'buy' },
  { id: 'sell', label: 'Sell', icon: 'sell', target: 'sell' },
  { id: 'repair', label: 'Repair', icon: 'repair', target: 'repair' },
  { id: 'guard', label: 'Screen Guard', icon: 'shield', target: 'screenguard' },
  { id: 'refurbish', label: 'Refurbish', icon: 'auto', target: 'buy' },
];

// The faint devices floating at the edges: icon, share of the screen across and down, size, phase.
const DEVICES: [IconName, number, number, number, number][] = [
  ['auto', 0.1, 0.1, 34, 0], ['laptop', 0.82, 0.08, 38, 1.3], ['watch', 0.08, 0.86, 30, 2.4], ['tablet', 0.84, 0.88, 36, 3.6], ['headphones', 0.5, 0.92, 30, 4.8],
];

const TILE = 78;
const HALO = 7; // the soft edge around a tile
const TILT = 1.42; // the orbit's height against its width: a tall ring, which keeps the logo in the middle clear
const LEAN = -0.1; // the orbit's slant, in radians
const TURN_SECONDS = 9;
const MIN_SHOW = 3200; // always long enough to be seen
const MAX_SHOW = 6500; // never held longer, however slow the network
const STAGGER = 95;
const FLIGHT = 780;
const LANDED = 460; // the ripple after the last landing
const TAU = Math.PI * 2;

type Spot = { x: number; y: number };
type Orbit = { cx: number; cy: number; radius: number; angle: SharedValue<number> };

function place(angle: number, radius: number) {
  'worklet';
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius * TILT;
  return { x: x * Math.cos(LEAN) - y * Math.sin(LEAN), y: x * Math.sin(LEAN) + y * Math.cos(LEAN), depth: Math.sin(angle) };
}

/** Same numbers on every launch, so the sky is designed rather than random. */
function scatter(seed: number) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function LaunchIntro() {
  const colors = useColors();
  const d = useDesign();
  const { scheme } = useTheme();
  const greeting = festiveGreeting(d.festive);
  const { width: screen, height: tall } = useWindowDimensions();
  const fetching = useIsFetching();
  const [started, setStarted] = useState(false);
  const [spots, setSpots] = useState<(Spot | null)[] | null>(null);
  const [waited, setWaited] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [done, setDone] = useState(false);

  const height = Math.min(46, (screen * 0.5) / RATIO);
  const full = height * RATIO;
  const phone = full * PHONE;
  const markHeight = height * 1.75;
  const radius = Math.min(screen * 0.365, 180);
  const cx = screen / 2;
  const cy = tall * 0.46;

  const angle = useSharedValue(-Math.PI / 2); // the clock behind everything that loops
  const sky = useSharedValue(0);
  const logo = useSharedValue(0);
  const hidden = useSharedValue(full - phone); // how much of the wordmark is still covered
  const burst = useSharedValue(0);
  const sweep = useSharedValue(0);
  const exit = useSharedValue(0);

  // Wait two frames, so the first screen has been mounted and nothing competes with the opening.
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        SplashScreen.hide();
        setStarted(true);
        const out = Easing.bezier(0.22, 1, 0.36, 1);
        sky.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) });
        logo.value = withDelay(120, withTiming(1, { duration: 760, easing: Easing.bezier(0.2, 1.25, 0.35, 1) }));
        burst.value = withDelay(220, withTiming(1, { duration: 1050, easing: out }));
        hidden.value = withDelay(460, withTiming(0, { duration: 680, easing: out }));
        sweep.value = withDelay(1180, withTiming(1, { duration: 720, easing: Easing.inOut(Easing.quad) }));
        angle.value = withRepeat(withTiming(angle.value + TAU, { duration: TURN_SECONDS * 1000, easing: Easing.linear }), -1, false);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimation(angle);
    };
  }, [sky, logo, burst, hidden, sweep, angle]);

  useEffect(() => {
    if (!started) return undefined;
    const finish = () => {
      launchCovering.value = false;
      setDone(true);
    };
    const min = setTimeout(() => setWaited(true), MIN_SHOW);
    const max = setTimeout(() => setGaveUp(true), MAX_SHOW);
    const last = setTimeout(finish, MAX_SHOW + 3000); // whatever happens, the app is never left behind this
    return () => {
      clearTimeout(min);
      clearTimeout(max);
      clearTimeout(last);
    };
  }, [started]);

  // Loaded: find the real buttons, then let the icons go.
  useEffect(() => {
    if (spots || !(gaveUp || (waited && fetching === 0))) return;
    void Promise.all(SERVICES.map(s => measureLaunchTarget(s.target))).then(found => {
      setSpots(found.map(spot => (spot ? { x: spot.x + spot.width / 2, y: Math.min(spot.y + spot.height / 2, tall + TILE) } : null)));
      exit.value = withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) });
      setTimeout(() => {
        launchCovering.value = false;
        setDone(true);
      }, STAGGER * (SERVICES.length - 1) + FLIGHT + LANDED);
    });
  }, [spots, gaveUp, waited, fetching, tall, exit]);

  const [glowA, glowB] = d.launchGlow;
  const base = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const gradient = useAnimatedStyle(() => ({ opacity: sky.value * (1 - exit.value) }));
  const stack = useAnimatedStyle(() => ({
    opacity: Math.min(logo.value, 1) * (1 - exit.value),
    transform: [{ scale: (0.72 + logo.value * 0.28) * (1 + Math.sin(angle.value * 2) * 0.012) * (1 + exit.value * 0.3) }],
  }));
  // The window slides left and the lettering right by the same amount: it stays put while being uncovered.
  const reveal = useAnimatedStyle(() => ({ transform: [{ translateX: -hidden.value }] }));
  const lettering = useAnimatedStyle(() => ({ transform: [{ translateX: hidden.value }] }));
  const light = useAnimatedStyle(() => ({ transform: [{ translateX: -full * 0.4 + sweep.value * full * 1.4 }], opacity: sweep.value < 1 ? 1 : 0 }));
  const halo = useAnimatedStyle(() => ({ opacity: (0.75 + Math.sin(angle.value * 3) * 0.25) * sky.value * (1 - exit.value), transform: [{ scale: 1 + Math.sin(angle.value * 3) * 0.07 + exit.value * 1.6 }] }));
  const rays = useAnimatedStyle(() => ({ opacity: sky.value * (1 - exit.value), transform: [{ rotate: `${angle.value * 0.5}rad` }] }));
  const ring = useAnimatedStyle(() => ({ opacity: logo.value * 0.9 * (1 - exit.value) }));
  const shock = useAnimatedStyle(() => ({ opacity: burst.value > 0 ? (1 - burst.value) * 0.9 : 0, transform: [{ scale: 0.25 + burst.value * 2.5 }] }));
  const sparks = useAnimatedStyle(() => ({ opacity: burst.value > 0 ? 1 - burst.value : 0, transform: [{ scale: 0.3 + burst.value * 1.5 }, { rotate: `${burst.value * 0.5}rad` }] }));

  if (done) return null;
  const orbit = { cx, cy, radius, angle };
  const size = radius * 3;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root]} accessibilityLabel="Fonzkart">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, base]} />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundImage: d.launchGradient }, gradient]} />

      <Aurora angle={angle} sky={sky} exit={exit} size={screen * 1.35} x={screen * 0.12} y={tall * 0.2} reach={screen * 0.16} phase={0} color={glowA} />
      <Aurora angle={angle} sky={sky} exit={exit} size={screen * 1.2} x={screen * 0.88} y={tall * 0.74} reach={screen * 0.18} phase={2.2} color={glowB} />

      {DEVICES.map(([icon, x, y, s, phase]) => (
        <Drifter key={icon} icon={icon} left={screen * x - s / 2} top={tall * y - s / 2} size={s} phase={phase} angle={angle} sky={sky} exit={exit} color={colors.green} />
      ))}
      {[0, 1, 2].map(layer => <Stardust key={layer} layer={layer} width={screen} height={tall} angle={angle} sky={sky} exit={exit} color={d.scheme === 'dark' ? '#ffffff' : colors.green} />)}

      <Animated.View style={[styles.place, { left: cx - size / 2, top: cy - size / 2, width: size, height: size }, rays]}>
        {[0, 60, 120].map(turn => (
          <View key={turn} style={[StyleSheet.absoluteFill, {
            borderRadius: size / 2, transform: [{ rotate: `${turn}deg` }, { scaleY: 0.1 }],
            backgroundImage: `radial-gradient(circle, rgba(${glowA},0.3) 0%, rgba(${glowA},0.1) 40%, rgba(${glowA},0) 70%)`,
          }]} />
        ))}
      </Animated.View>
      <Animated.View style={[styles.place, {
        left: cx - radius, top: cy - radius, width: radius * 2, height: radius * 2, borderRadius: radius,
        backgroundImage: `radial-gradient(circle, rgba(${glowA},0.42) 0%, rgba(${glowA},0.14) 42%, rgba(${glowA},0) 70%)`,
      }, halo]} />
      <Animated.View style={[styles.ring, {
        left: cx - radius, top: cy - radius, width: radius * 2, height: radius * 2, borderRadius: radius, borderColor: colors.greenBorder,
        transform: [{ rotate: `${LEAN}rad` }, { scaleY: TILT }],
      }, ring]} renderToHardwareTextureAndroid />

      <Animated.View style={[styles.shock, { left: cx - 70, top: cy - 70, borderColor: colors.green }, shock]} />
      <Animated.View style={[styles.place, { left: cx, top: cy }, sparks]}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * TAU;
          const far = 96 + scatter(i + 3) * 44;
          return <View key={i} style={[styles.spark, { left: Math.cos(a) * far, top: Math.sin(a) * far, backgroundColor: i % 2 ? colors.green : d.heroAccent }]} />;
        })}
      </Animated.View>

      {[0, 2.1, 4.2].map(offset => <OrbitSpark key={offset} offset={offset} orbit={orbit} logo={logo} exit={exit} color={colors.green} />)}

      <Animated.View style={[styles.stack, { left: cx - full / 2, top: cy - (markHeight + height + 12) / 2, width: full }, stack]}>
        <Image source={MARK} style={[{ height: markHeight, width: markHeight * MARK_RATIO }, greeting ? { tintColor: colors.green } : null]} resizeMode="contain" />
        <View style={{ height, width: full, overflow: 'hidden' }}>
          <Animated.View style={[{ height, width: full, overflow: 'hidden' }, reveal]}>
            <Animated.View style={lettering}>
              <Image source={scheme === 'dark' ? WORDMARK_DARK : WORDMARK} style={{ width: full, height }} resizeMode="contain" />
              <Animated.View style={[styles.light, { height, width: full * 0.28 }, light]} />
            </Animated.View>
          </Animated.View>
        </View>
        {greeting ? <Text style={[styles.greeting, { color: colors.green }]} numberOfLines={1}>{greeting}</Text> : null}
      </Animated.View>

      {started ? SERVICES.map((service, index) => (
        <OrbitTile key={service.id} label={service.label} icon={service.icon} index={index} orbit={orbit}
          flying={!!spots} spot={spots?.[index] ?? { x: cx, y: tall + TILE }} />
      )) : null}
    </View>
  );
}

/** A huge soft light drifting on a slow circle. */
function Aurora({ angle, sky, exit, size, x, y, reach, phase, color }: {
  angle: SharedValue<number>;
  sky: SharedValue<number>;
  exit: SharedValue<number>;
  size: number;
  x: number;
  y: number;
  reach: number;
  phase: number;
  color: string;
}) {
  const drift = useAnimatedStyle(() => ({
    opacity: sky.value * (1 - exit.value),
    transform: [{ translateX: Math.cos(angle.value + phase) * reach }, { translateY: Math.sin(angle.value + phase) * reach * 0.8 }, { scale: 1 + Math.sin(angle.value * 2 + phase) * 0.08 }],
  }));
  return (
    <Animated.View style={[styles.place, {
      left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2,
      backgroundImage: `radial-gradient(circle, rgba(${color},0.34) 0%, rgba(${color},0.1) 45%, rgba(${color},0) 70%)`,
    }, drift]} />
  );
}

/** A faint device bobbing at the edge of the sky. */
function Drifter({ icon, left, top, size, phase, angle, sky, exit, color }: {
  icon: IconName;
  left: number;
  top: number;
  size: number;
  phase: number;
  angle: SharedValue<number>;
  sky: SharedValue<number>;
  exit: SharedValue<number>;
  color: string;
}) {
  const bob = useAnimatedStyle(() => ({
    opacity: sky.value * 0.3 * (1 - exit.value),
    transform: [{ translateY: Math.sin(angle.value + phase) * 13 }, { rotate: `${Math.sin(angle.value * 2 + phase) * 9}deg` }],
  }));
  return <Animated.View renderToHardwareTextureAndroid style={[styles.place, { left, top }, bob]}><Icon name={icon} color={color} size={size} strokeWidth={1.3} /></Animated.View>;
}

/** One layer of stars: the whole layer twinkles and rises as a single view. */
function Stardust({ layer, width, height, angle, sky, exit, color }: {
  layer: number;
  width: number;
  height: number;
  angle: SharedValue<number>;
  sky: SharedValue<number>;
  exit: SharedValue<number>;
  color: string;
}) {
  const stars = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const seed = layer * 17 + i + 1;
    return { left: scatter(seed) * width, top: scatter(seed + 41) * height, size: 1.5 + scatter(seed + 83) * 2.5 };
  }), [layer, width, height]);
  const phase = layer * 2.1;
  const twinkle = useAnimatedStyle(() => ({
    opacity: (0.32 + (Math.sin(angle.value * 4 + phase) + 1) * 0.3) * sky.value * (1 - exit.value),
    transform: [{ translateY: Math.sin(angle.value + phase) * (10 + layer * 7) }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, twinkle]}>
      {stars.map(s => <View key={s.left} style={[styles.place, { left: s.left, top: s.top, width: s.size, height: s.size, borderRadius: s.size, backgroundColor: color }]} />)}
    </Animated.View>
  );
}

/** One service: spirals out of the logo, circles it, and once `flying`, leaves for `spot`. */
function OrbitTile({ label, icon, index, orbit, flying, spot }: {
  label: string;
  icon: IconName;
  index: number;
  orbit: Orbit;
  flying: boolean;
  spot: Spot;
}) {
  const colors = useColors();
  const { cx, cy, radius, angle } = orbit;
  const offset = (index / SERVICES.length) * TAU;
  const spread = useSharedValue(0);
  const flight = useSharedValue(0);
  const ripple = useSharedValue(0);
  const targetX = spot.x - cx;
  const targetY = spot.y - cy;
  const box = TILE + HALO * 2;

  useEffect(() => {
    spread.value = withDelay(260 + index * 120, withTiming(1, { duration: 1150, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [index, spread]);

  useEffect(() => {
    if (!flying) return;
    const delay = index * STAGGER;
    flight.value = withDelay(delay, withTiming(1, { duration: FLIGHT, easing: Easing.bezier(0.5, 0, 0.15, 1) }));
    ripple.value = withDelay(delay + FLIGHT - 60, withTiming(1, { duration: LANDED, easing: Easing.out(Easing.quad) }));
  }, [flying, index, flight, ripple]);

  const tile = useAnimatedStyle(() => {
    const s = spread.value;
    const a = angle.value + offset - (1 - s) * 2.2;
    const at = place(a, radius * s);
    const near = (at.depth + 1) / 2;
    const f = flight.value;
    return {
      opacity: Math.min(s * 2.2, 1) * (0.72 + near * 0.28) * (1 - f) + f * (f > 0.93 ? (1 - f) / 0.07 : 1),
      transform: [
        { translateX: at.x * (1 - f) + targetX * f },
        { translateY: at.y * (1 - f) + targetY * f - Math.sin(f * Math.PI) * 54 },
        { perspective: 420 },
        { rotateY: `${Math.cos(a) * -20 * (1 - f)}deg` },
        { scale: (0.5 + s * (0.3 + near * 0.32)) * (1 - f) + 0.44 * f },
      ],
    };
  });
  const words = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - flight.value * 3) }));
  const wave = useAnimatedStyle(() => ({
    opacity: ripple.value > 0 ? (1 - ripple.value) * 0.85 : 0,
    transform: [{ translateX: targetX }, { translateY: targetY }, { scale: 0.3 + ripple.value * 1.15 }],
  }));

  return (
    <>
      <Animated.View style={[styles.wave, { left: cx - 32, top: cy - 32, borderColor: colors.green }, wave]} />
      {[0.05, 0.1, 0.16].map(lag => (
        <TrailStar key={lag} lag={lag} flight={flight} orbit={orbit} offset={offset} targetX={targetX} targetY={targetY} color={colors.green} />
      ))}
      <Animated.View renderToHardwareTextureAndroid style={[styles.place, styles.tileBox, { left: cx - box / 2, top: cy - box / 2, width: box, height: box, backgroundColor: colors.greenTint }, tile]}>
        <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.greenBorder }]}>
          <Icon name={icon} color={colors.green} size={30} filled />
          <Animated.View style={words}>
            <Text style={[styles.label, { color: colors.navy }]} numberOfLines={1}>{label}</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </>
  );
}

/** Stardust following a flying tile: the tile's own path, a moment behind. */
function TrailStar({ lag, flight, orbit, offset, targetX, targetY, color }: {
  lag: number;
  flight: SharedValue<number>;
  orbit: Orbit;
  offset: number;
  targetX: number;
  targetY: number;
  color: string;
}) {
  const { cx, cy, radius, angle } = orbit;
  const dust = useAnimatedStyle(() => {
    const f = Math.max(0, flight.value - lag);
    const at = place(angle.value + offset, radius);
    return {
      opacity: f > 0 && f < 0.97 ? Math.sin(f * Math.PI) * (1 - lag * 3.5) : 0,
      transform: [
        { translateX: at.x * (1 - f) + targetX * f },
        { translateY: at.y * (1 - f) + targetY * f - Math.sin(f * Math.PI) * 54 },
        { scale: 1 - lag * 3 },
      ],
    };
  });
  return <Animated.View style={[styles.trail, { left: cx - 5, top: cy - 5, backgroundColor: color }, dust]} />;
}

/** A small spark riding just outside the orbit, the other way round. */
function OrbitSpark({ offset, orbit, logo, exit, color }: { offset: number; orbit: Orbit; logo: SharedValue<number>; exit: SharedValue<number>; color: string }) {
  const { cx, cy, radius, angle } = orbit;
  const dot = useAnimatedStyle(() => {
    const at = place(-angle.value + offset, radius * 1.16);
    return {
      opacity: Math.min(logo.value, 1) * (1 - exit.value) * (0.35 + (at.depth + 1) * 0.3),
      transform: [{ translateX: at.x }, { translateY: at.y }],
    };
  });
  return <Animated.View style={[styles.dot, { left: cx - 3, top: cy - 3, backgroundColor: color }, dot]} />;
}

const styles = StyleSheet.create({
  root: { zIndex: 100, overflow: 'hidden' },
  place: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 1.5, borderStyle: 'dashed' },
  shock: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 2 },
  spark: { position: 'absolute', width: 5, height: 5, borderRadius: 3 },
  stack: { position: 'absolute', alignItems: 'center', gap: 12 },
  light: { position: 'absolute', top: 0, left: 0, backgroundImage: 'linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.75) 50%, transparent 100%)' },
  tileBox: { borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  tile: { width: TILE, height: TILE, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  greeting: { fontSize: 15, lineHeight: 20, fontWeight: '800', letterSpacing: -0.2 },
  label: { fontSize: 10.5, lineHeight: 13, fontWeight: '700', letterSpacing: -0.1 },
  wave: { position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 2 },
  trail: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
});
