// The launch animation, played once per app start over the first screen. On a themed sky of drifting aurora lights,
// rising stardust and floating devices, the F logo appears and the ONZKA₹T lettering is unveiled under it, while
// Fonzkart's services (Sell, Buy, Repair, Screen Guard, Refurbish) turn around them like a precision dial: small round
// icons on one faint line snap round a position at a time, smearing as they surge. Each stop is one service's moment:
// it pops forward, large and glowing, with a pulse ring, the others dim, and its name appears under the logo. When the
// app has loaded, the sky fades away and each icon flies to its real button with a trail of stardust, landing with
// a ripple: Sell, Buy and Repair on the tab bar (Refurbish with Buy), Screen Guard on its card further down home.
//
// Smoothness rules, as this is the app's first impression: only transforms and opacity animate (never width, zIndex or
// shadows, which redo layout or repainting every frame); two clocks drive everything that loops (`angle` the sky, `spin`
// the dial); groups of stars move as one view; the home screen's drawings wait (launchCovering); and nothing starts
// until the first screen has been mounted.
import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { useIsFetching } from '@tanstack/react-query';
import { useColors, useTheme } from '@fonzkart/ui';
import { festiveGreeting, Icon, type IconName, useDesign } from './design';
import { ServiceGlyph, type ServiceGlyphName } from './launchGlyphs';
import { launchCovering, measureLaunchTarget } from './launchTargets';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const MARK = require('../../../brand/fonzkart_f_mark.png');
const MARK_RATIO = 450 / 675; // the F's width / height
const WORDMARK = require('../../../brand/fonzkart_wordmark.png');
const WORDMARK_DARK = require('../../../brand/fonzkart_wordmark_dark.png');
const RATIO = 1408 / 346; // wordmark width / height
const PHONE = 190 / 1408; // share of the wordmark's width taken by the F-phone

// In the order the dial shows them.
const SERVICES: { id: ServiceGlyphName; word: string; target: string }[] = [
  { id: 'sell', word: 'Sell', target: 'sell' },
  { id: 'buy', word: 'Buy', target: 'buy' },
  { id: 'repair', word: 'Repair', target: 'repair' },
  { id: 'guard', word: 'Screen Guard', target: 'screenguard' },
  { id: 'refurbish', word: 'Refurbish', target: 'buy' },
];
const COUNT = SERVICES.length;

// The faint devices floating at the edges: icon, share of the screen across and down, size, phase.
const DEVICES: [IconName, number, number, number, number][] = [
  ['auto', 0.1, 0.1, 34, 0], ['laptop', 0.82, 0.08, 38, 1.3], ['watch', 0.08, 0.86, 30, 2.4], ['tablet', 0.84, 0.88, 36, 3.6], ['headphones', 0.5, 0.92, 30, 4.8],
];

const TILE = 56;
const LANDING_SCALE = 0.72; // a tile's size on arrival: about the size of the tab bar's icons
const TILT = 1.34; // the orbit's height against its width: a tall ring, which keeps the logo in the middle clear
const LEAN = -0.1; // the orbit's slant, in radians
const SKY_SECONDS = 14; // one slow cycle of the sky
const BEAT = 700; // one click of the dial, in milliseconds
const MOVE = 0.6; // the share of a beat spent moving; the rest is the service's moment
const SPOTLIGHT = 0.5; // how much larger the lit service grows
const FRONT = Math.PI / 2; // the lit position: the bottom of the ring, nearest the viewer
const WORD_HEIGHT = 22;
const MIN_SHOW = 4500; // one full round of the dial
const MAX_SHOW = 6500; // never held longer, however slow the network
const STAGGER = 95;
const FLIGHT = 780;
const LANDED = 460; // the ripple after the last landing
const TAU = Math.PI * 2;
// The light along the top of a disc.
const GLOSS_DARK = 'linear-gradient(180deg, rgba(255,255,255,0.17) 0%, rgba(255,255,255,0) 100%)';
const GLOSS_LIGHT = 'linear-gradient(180deg, rgba(22,163,74,0.07) 0%, rgba(22,163,74,0) 100%)';
const GLOSS_LIT = 'linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 100%)';

type Spot = { x: number; y: number };
type Orbit = { cx: number; cy: number; radius: number; spin: SharedValue<number> };

function place(angle: number, radius: number) {
  'worklet';
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius * TILT;
  return { x: x * Math.cos(LEAN) - y * Math.sin(LEAN), y: x * Math.sin(LEAN) + y * Math.cos(LEAN), depth: Math.sin(angle) };
}

/** How far through the current click: 0 at a stop, surging to 1 at the next one. */
function click(spin: number) {
  'worklet';
  const beats = spin * COUNT;
  const t = Math.min(1, (beats - Math.floor(beats)) / MOVE);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** The dial's turn for `spin` (0 to 1 is one round at a steady speed), moving in clicks. */
function dial(spin: number) {
  'worklet';
  return (-(Math.floor(spin * COUNT) + click(spin)) / COUNT) * TAU;
}

/** 1 while the service at `offset` is at the lit position, fading to 0 half a click away. */
function lit(spin: number, offset: number) {
  'worklet';
  const a = dial(spin) + offset;
  const c = Math.max(0, 1 - Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) / (Math.PI / COUNT));
  return c * c * (3 - 2 * c);
}

/** How long ago (in beats) the service at `index` reached the lit position. */
function since(spin: number, index: number) {
  'worklet';
  const u = (spin * COUNT - index + 1 - MOVE) % COUNT;
  return u < 0 ? u + COUNT : u;
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

  const angle = useSharedValue(-Math.PI / 2); // the sky's slow clock
  const spin = useSharedValue(0); // the dial's clock
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
        angle.value = withRepeat(withTiming(angle.value + TAU, { duration: SKY_SECONDS * 1000, easing: Easing.linear }), -1, false);
        spin.value = withDelay(1000, withRepeat(withTiming(1, { duration: BEAT * COUNT, easing: Easing.linear }), -1, false));
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimation(angle);
      cancelAnimation(spin);
    };
  }, [sky, logo, burst, hidden, sweep, angle, spin]);

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
      // The dial finishes its click and stops.
      const next = (Math.floor(spin.value * COUNT) + 1) / COUNT;
      spin.value = withTiming(next, { duration: (next - spin.value) * BEAT * COUNT, easing: Easing.linear });
      setTimeout(() => {
        launchCovering.value = false;
        setDone(true);
      }, STAGGER * (COUNT - 1) + FLIGHT + LANDED);
    });
  }, [spots, gaveUp, waited, fetching, tall, exit, spin]);

  const [glowA, glowB] = d.launchGlow;
  const base = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const gradient = useAnimatedStyle(() => ({ opacity: sky.value * (1 - exit.value) }));
  const stack = useAnimatedStyle(() => ({
    opacity: Math.min(logo.value, 1) * (1 - exit.value),
    transform: [{ scale: (0.72 + logo.value * 0.28) * (1 + Math.sin(click(spin.value) * Math.PI) * 0.014) * (1 + exit.value * 0.3) }],
  }));
  // The window slides left and the lettering right by the same amount: it stays put while being uncovered.
  const reveal = useAnimatedStyle(() => ({ transform: [{ translateX: -hidden.value }] }));
  const lettering = useAnimatedStyle(() => ({ transform: [{ translateX: hidden.value }] }));
  const light = useAnimatedStyle(() => ({ transform: [{ translateX: -full * 0.4 + sweep.value * full * 1.4 }], opacity: sweep.value < 1 ? 1 : 0 }));
  const halo = useAnimatedStyle(() => ({ opacity: (0.6 + Math.sin(angle.value * 3) * 0.12) * sky.value * (1 - exit.value), transform: [{ scale: 1 + Math.sin(angle.value * 3) * 0.04 + exit.value * 1.6 }] }));
  const ring = useAnimatedStyle(() => ({ opacity: logo.value * 0.55 * (1 - exit.value) }));
  const shock = useAnimatedStyle(() => ({ opacity: burst.value > 0 ? (1 - burst.value) * 0.35 : 0, transform: [{ scale: 0.4 + burst.value * 1.5 }] }));

  if (done) return null;
  const orbit = { cx, cy, radius, spin };
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

      <Animated.View style={[styles.place, {
        left: cx - radius, top: cy - radius, width: radius * 2, height: radius * 2, borderRadius: radius,
        backgroundImage: `radial-gradient(circle, rgba(${glowA},0.42) 0%, rgba(${glowA},0.14) 42%, rgba(${glowA},0) 70%)`,
      }, halo]} />
      <Animated.View style={[styles.ring, {
        left: cx - radius, top: cy - radius, width: radius * 2, height: radius * 2, borderRadius: radius, borderColor: colors.greenBorder,
        transform: [{ rotate: `${LEAN}rad` }, { scaleY: TILT }],
      }, ring]} />

      <Animated.View style={[styles.shock, { left: cx - 70, top: cy - 70, borderColor: colors.green }, shock]} />
      <Animated.View style={[styles.stack, { left: cx - full / 2, top: cy - (markHeight + height + WORD_HEIGHT + 24) / 2, width: full }, stack]}>
        <Image source={MARK} style={[{ height: markHeight, width: markHeight * MARK_RATIO }, greeting ? { tintColor: colors.green } : null]} resizeMode="contain" />
        <View style={{ height, width: full, overflow: 'hidden' }}>
          <Animated.View style={[{ height, width: full, overflow: 'hidden' }, reveal]}>
            <Animated.View style={lettering}>
              <Image source={scheme === 'dark' ? WORDMARK_DARK : WORDMARK} style={{ width: full, height }} resizeMode="contain" />
              <Animated.View style={[styles.light, { height, width: full * 0.28 }, light]} />
            </Animated.View>
          </Animated.View>
        </View>
        <View style={styles.words}>
          {SERVICES.map((service, index) => <ServiceWord key={service.id} word={service.word} offset={(index / COUNT) * TAU} spin={spin} color={colors.greenDark} />)}
        </View>
        {greeting ? <Text style={[styles.greeting, { color: colors.green }]} numberOfLines={1}>{greeting}</Text> : null}
      </Animated.View>

      {started ? SERVICES.map((service, index) => (
        <OrbitTile key={service.id} glyph={service.id} index={index} orbit={orbit}
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

/** The name of the service at the lit position, rising in as it arrives. */
function ServiceWord({ word, offset, spin, color }: { word: string; offset: number; spin: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const on = lit(spin.value, offset);
    return { opacity: on, transform: [{ translateY: (1 - on) * 7 }] };
  });
  return <Animated.Text style={[styles.word, { color }, style]} numberOfLines={1}>{word}</Animated.Text>;
}

/** One service: fades in on the dial, clicks round the logo, and once `flying`, leaves for `spot`. */
function OrbitTile({ glyph, index, orbit, flying, spot }: {
  glyph: ServiceGlyphName;
  index: number;
  orbit: Orbit;
  flying: boolean;
  spot: Spot;
}) {
  const colors = useColors();
  const d = useDesign();
  const { cx, cy, radius, spin } = orbit;
  const offset = (index / COUNT) * TAU;
  const spread = useSharedValue(0);
  const flight = useSharedValue(0);
  const ripple = useSharedValue(0);
  const targetX = spot.x - cx;
  const targetY = spot.y - cy;

  useEffect(() => {
    spread.value = withDelay(180 + index * 70, withTiming(1, { duration: 720, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
  }, [index, spread]);

  useEffect(() => {
    if (!flying) return;
    const delay = index * STAGGER;
    flight.value = withDelay(delay, withTiming(1, { duration: FLIGHT, easing: Easing.bezier(0.5, 0, 0.15, 1) }));
    ripple.value = withDelay(delay + FLIGHT - 60, withTiming(1, { duration: LANDED, easing: Easing.out(Easing.quad) }));
  }, [flying, index, flight, ripple]);

  const tile = useAnimatedStyle(() => {
    const s = spread.value;
    const on = lit(spin.value, offset);
    const at = place(FRONT + dial(spin.value) + offset - (1 - s) * 0.5, radius * (0.82 + s * 0.18 + on * 0.08));
    const near = (at.depth + 1) / 2;
    const f = flight.value;
    const age = since(spin.value, index);
    const pop = spin.value > 0 && age < 0.55 ? Math.sin((age / 0.55) * Math.PI) * 0.1 : 0;
    return {
      opacity: s * (0.5 + near * 0.22 + on * 0.28) * (1 - f) + f * (f > 0.93 ? (1 - f) / 0.07 : 1),
      transform: [
        { translateX: at.x * (1 - f) + targetX * f },
        { translateY: at.y * (1 - f) + targetY * f - Math.sin(f * Math.PI) * 54 },
        { scale: (0.74 + near * 0.2 + on * SPOTLIGHT + pop) * (1 - f) + LANDING_SCALE * f },
      ],
    };
  });
  const fill = useAnimatedStyle(() => ({ opacity: lit(spin.value, offset) * Math.max(0, 1 - flight.value * 4) }));
  const pulse = useAnimatedStyle(() => {
    const p = since(spin.value, index) / 0.95;
    const on = spin.value > 0 && p < 1 && flight.value === 0;
    return { opacity: on ? (1 - p) * 0.7 : 0, transform: [{ scale: 1 + p * 0.85 }] };
  });
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
      {[[0.009, 0.04], [0.006, 0.065], [0.003, 0.09]].map(([lag, strength]) => (
        <Smear key={lag} lag={lag!} strength={strength!} offset={offset} orbit={orbit} spread={spread} flight={flight} color={colors.green} />
      ))}
      <Animated.View style={[styles.tile, { left: cx - TILE / 2, top: cy - TILE / 2 }, tile]}>
        <Animated.View style={[styles.aura, { backgroundImage: `radial-gradient(circle, rgba(${d.launchGlow[0]},0.55) 0%, rgba(${d.launchGlow[0]},0.16) 45%, rgba(${d.launchGlow[0]},0) 70%)` }, fill]} />
        <Animated.View style={[styles.pulse, { borderColor: colors.green }, pulse]} />
        <View style={[styles.disc, { backgroundColor: colors.surface, borderColor: colors.greenBorder }]}>
          <View style={[styles.gloss, { backgroundImage: d.scheme === 'dark' ? GLOSS_DARK : GLOSS_LIGHT }]} />
          <ServiceGlyph name={glyph} color={colors.green} size={28} />
        </View>
        <Animated.View style={[styles.disc, styles.litDisc, { backgroundImage: d.greenGradient }, fill]}>
          <View style={[styles.gloss, { backgroundImage: GLOSS_LIT }]} />
          <ServiceGlyph name={glyph} color={d.onGreen} size={28} />
        </Animated.View>
      </Animated.View>
    </>
  );
}

/** Motion blur: a faint copy of the tile a moment behind it. It stretches away as the dial surges and closes up at each stop. */
function Smear({ lag, strength, offset, orbit, spread, flight, color }: {
  lag: number;
  strength: number;
  offset: number;
  orbit: Orbit;
  spread: SharedValue<number>;
  flight: SharedValue<number>;
  color: string;
}) {
  const { cx, cy, radius, spin } = orbit;
  const smear = useAnimatedStyle(() => {
    const s = spread.value;
    const at = place(FRONT + dial(spin.value + 1 - lag) + offset - (1 - s) * 0.5, radius * (0.82 + s * 0.18));
    return {
      opacity: strength * s * Math.max(0, 1 - flight.value * 6),
      transform: [{ translateX: at.x }, { translateY: at.y }, { scale: 0.78 + ((at.depth + 1) / 2) * 0.26 }],
    };
  });
  return <Animated.View style={[styles.smear, { left: cx - TILE / 2, top: cy - TILE / 2, backgroundColor: color }, smear]} />;
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
  const { cx, cy, radius, spin } = orbit;
  const dust = useAnimatedStyle(() => {
    const f = Math.max(0, flight.value - lag);
    const at = place(FRONT + dial(spin.value) + offset, radius);
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

const styles = StyleSheet.create({
  root: { zIndex: 100, overflow: 'hidden' },
  place: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth },
  shock: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 1 },
  stack: { position: 'absolute', alignItems: 'center', gap: 12 },
  light: { position: 'absolute', top: 0, left: 0, backgroundImage: 'linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.75) 50%, transparent 100%)' },
  tile: { position: 'absolute', width: TILE, height: TILE },
  disc: { position: 'absolute', top: 0, left: 0, width: TILE, height: TILE, borderRadius: TILE / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  litDisc: { borderColor: 'rgba(255,255,255,0.4)' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: TILE * 0.55 },
  aura: { position: 'absolute', top: -TILE * 0.75, left: -TILE * 0.75, width: TILE * 2.5, height: TILE * 2.5, borderRadius: TILE * 1.25 },
  pulse: { position: 'absolute', top: 0, left: 0, width: TILE, height: TILE, borderRadius: TILE / 2, borderWidth: 1.5 },
  smear: { position: 'absolute', width: TILE, height: TILE, borderRadius: TILE / 2 },
  words: { height: WORD_HEIGHT, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  word: { position: 'absolute', fontSize: 15, lineHeight: WORD_HEIGHT, fontWeight: '800', letterSpacing: 3.5, textTransform: 'uppercase' },
  greeting: { fontSize: 15, lineHeight: 20, fontWeight: '800', letterSpacing: -0.2 },
  wave: { position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 2 },
  trail: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
});
