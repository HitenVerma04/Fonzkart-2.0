// The launch animation, played once per app start over the first screen. The F logo and the ONZKA₹T lettering sit in
// the middle while Fonzkart's services (Buy, Sell, Repair, Screen Guard, Refurbish) circle them in 3D, passing behind
// and in front. When the app has loaded, the page fades away and each icon flies to its real button, landing with a
// green ripple: Sell, Buy and Repair on the tab bar (Refurbish with Buy), Screen Guard on its card further down home.
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { useIsFetching } from '@tanstack/react-query';
import { useColors, useTheme } from '@fonzkart/ui';
import { festiveGreeting, Icon, type IconName, useDesign } from './design';
import { measureLaunchTarget } from './launchTargets';

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

const TILE = 78;
const TILT = 1.42; // the orbit's height against its width: a tall ring, which keeps the logo in the middle clear
const LEAN = -0.1; // the orbit's slant, in radians
const TURN_SECONDS = 8;
const MIN_SHOW = 3000; // always long enough to be seen
const MAX_SHOW = 6500; // never held longer, however slow the network
const STAGGER = 90;
const FLIGHT = 720;

type Orbit = { cx: number; cy: number; radius: number; angle: SharedValue<number>; open: SharedValue<number> };
type Spot = { x: number; y: number };

function place(angle: number, radius: number) {
  'worklet';
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius * TILT;
  return { x: x * Math.cos(LEAN) - y * Math.sin(LEAN), y: x * Math.sin(LEAN) + y * Math.cos(LEAN), depth: Math.sin(angle) };
}

export function LaunchIntro() {
  const colors = useColors();
  const { scheme } = useTheme();
  const { festive } = useDesign();
  const greeting = festiveGreeting(festive);
  const { width: screen, height: tall } = useWindowDimensions();
  const fetching = useIsFetching();
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

  const angle = useSharedValue(-Math.PI / 2);
  const open = useSharedValue(0); // the icons spreading out from the logo
  const reveal = useSharedValue(phone); // visible width of the wordmark
  const pop = useSharedValue(0.7);
  const glow = useSharedValue(0);
  const sweep = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    SplashScreen.hide();
    const ease = Easing.bezier(0.22, 1, 0.36, 1);
    pop.value = withSpring(1, { damping: 15, stiffness: 150 });
    glow.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, true);
    reveal.value = withDelay(320, withTiming(full, { duration: 620, easing: ease }));
    sweep.value = withDelay(950, withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }));
    open.value = withDelay(180, withSpring(1, { damping: 16, stiffness: 90 }));
    angle.value = withRepeat(withTiming(angle.value + Math.PI * 2, { duration: TURN_SECONDS * 1000, easing: Easing.linear }), -1, false);
    const min = setTimeout(() => setWaited(true), MIN_SHOW);
    const max = setTimeout(() => setGaveUp(true), MAX_SHOW);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
      cancelAnimation(angle);
      cancelAnimation(glow);
    };
  }, [full, pop, glow, reveal, sweep, open, angle]);

  // Loaded: find the real buttons, then let the icons go.
  useEffect(() => {
    if (spots || !(gaveUp || (waited && fetching === 0))) return;
    void Promise.all(SERVICES.map(s => measureLaunchTarget(s.target))).then(found => {
      setSpots(found.map(spot => (spot ? { x: spot.x + spot.width / 2, y: Math.min(spot.y + spot.height / 2, tall + TILE) } : null)));
      exit.value = withTiming(1, { duration: 460, easing: Easing.out(Easing.quad) });
      const last = STAGGER * (SERVICES.length - 1) + FLIGHT + 460;
      setTimeout(() => setDone(true), last);
    });
  }, [spots, gaveUp, waited, fetching, tall, exit]);

  const backdrop = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const stack = useAnimatedStyle(() => ({ opacity: 1 - exit.value, transform: [{ scale: pop.value * (1 + exit.value * 0.25) }] }));
  const clip = useAnimatedStyle(() => ({ width: reveal.value }));
  const halo = useAnimatedStyle(() => ({ opacity: (0.08 + glow.value * 0.1) * (1 - exit.value), transform: [{ scale: 0.92 + glow.value * 0.16 }] }));
  const light = useAnimatedStyle(() => ({ transform: [{ translateX: -full * 0.4 + sweep.value * full * 1.4 }], opacity: sweep.value < 1 ? 1 : 0 }));
  const rings = useAnimatedStyle(() => ({ opacity: open.value * (1 - exit.value) }));

  if (done) return null;
  const orbit = { cx, cy, radius, angle, open };
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root]} accessibilityLabel="Fonzkart">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, backdrop]} />
      <Animated.View style={[styles.halo, {
        left: cx - radius * 0.62, top: cy - radius * 0.62, width: radius * 1.24, height: radius * 1.24, borderRadius: radius, backgroundColor: colors.green,
      }, halo]} />
      <Animated.View style={[styles.ring, {
        left: cx - radius, top: cy - radius, width: radius * 2, height: radius * 2, borderRadius: radius, borderColor: colors.greenBorder,
        transform: [{ rotate: `${LEAN}rad` }, { scaleY: TILT }],
      }, rings]} />

      {[0, 2.1, 4.2].map(offset => <OrbitDot key={offset} offset={offset} orbit={orbit} exit={exit} color={colors.green} />)}

      <Animated.View style={[styles.stack, { left: cx - full / 2, top: cy - (markHeight + height + 12) / 2, width: full }, stack]}>
        <Image source={MARK} style={[{ height: markHeight, width: markHeight * MARK_RATIO }, greeting ? { tintColor: colors.green } : null]} resizeMode="contain" />
        <Animated.View style={[{ height, overflow: 'hidden', alignSelf: 'flex-start' }, clip]}>
          <Image source={scheme === 'dark' ? WORDMARK_DARK : WORDMARK} style={{ width: full, height }} resizeMode="contain" />
          <Animated.View style={[styles.light, { height, width: full * 0.28 }, light]} />
        </Animated.View>
        {greeting ? <Text style={[styles.greeting, { color: colors.green }]} numberOfLines={1}>{greeting}</Text> : null}
      </Animated.View>

      {SERVICES.map((service, index) => (
        <OrbitTile key={service.id} label={service.label} icon={service.icon} index={index} orbit={orbit}
          flying={!!spots} spot={spots?.[index] ?? { x: cx, y: tall + TILE }} />
      ))}
    </View>
  );
}

/** One service on the orbit; once `flying`, it leaves for `spot`. */
function OrbitTile({ label, icon, index, orbit, flying, spot }: {
  label: string;
  icon: IconName;
  index: number;
  orbit: Orbit;
  flying: boolean;
  spot: Spot;
}) {
  const colors = useColors();
  const { cx, cy, radius, angle, open } = orbit;
  const offset = (index / SERVICES.length) * Math.PI * 2;
  const flight = useSharedValue(0);
  const ripple = useSharedValue(0);
  const targetX = spot.x - cx;
  const targetY = spot.y - cy;

  useEffect(() => {
    if (!flying) return;
    const delay = index * STAGGER;
    flight.value = withDelay(delay, withTiming(1, { duration: FLIGHT, easing: Easing.bezier(0.55, 0, 0.2, 1) }));
    ripple.value = withDelay(delay + FLIGHT - 60, withTiming(1, { duration: 440, easing: Easing.out(Easing.quad) }));
  }, [flying, index, flight, ripple]);

  const tile = useAnimatedStyle(() => {
    const at = place(angle.value + offset, radius * open.value);
    const near = (at.depth + 1) / 2;
    const f = flight.value;
    const arc = Math.sin(f * Math.PI) * 46;
    const scale = (0.78 + near * 0.34) * (1 - f) + 0.46 * f;
    const face = Math.cos(angle.value + offset) * -26 * (1 - f);
    return {
      zIndex: f > 0 ? 30 : at.depth > 0 ? 20 : 5,
      opacity: Math.min(open.value, 1) * (0.62 + near * 0.38) * (1 - f) + f * (f > 0.93 ? (1 - f) / 0.07 : 1),
      transform: [
        { translateX: at.x * (1 - f) + targetX * f },
        { translateY: at.y * (1 - f) + targetY * f - arc },
        { perspective: 420 },
        { rotateY: `${face}deg` },
        { scale },
      ],
    };
  });
  const words = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - flight.value * 3) }));
  const wave = useAnimatedStyle(() => ({
    opacity: ripple.value > 0 ? (1 - ripple.value) * 0.8 : 0,
    transform: [{ translateX: targetX }, { translateY: targetY }, { scale: 0.3 + ripple.value * 1.1 }],
  }));

  return (
    <>
      <Animated.View style={[styles.wave, { left: cx - 32, top: cy - 32, borderColor: colors.green }, wave]} />
      <Animated.View style={[styles.tile, { left: cx - TILE / 2, top: cy - TILE / 2, backgroundColor: colors.surface, borderColor: colors.greenBorder }, tile]}>
        <Icon name={icon} color={colors.green} size={30} filled />
        <Animated.View style={words}>
          <Text style={[styles.label, { color: colors.navy }]} numberOfLines={1}>{label}</Text>
        </Animated.View>
      </Animated.View>
    </>
  );
}

/** A small spark riding the orbit. */
function OrbitDot({ offset, orbit, exit, color }: { offset: number; orbit: Orbit; exit: SharedValue<number>; color: string }) {
  const { cx, cy, radius, angle, open } = orbit;
  const dot = useAnimatedStyle(() => {
    const at = place(-angle.value * 0.6 + offset, radius * 1.16 * open.value);
    return {
      opacity: open.value * (1 - exit.value) * (0.35 + (at.depth + 1) * 0.3),
      transform: [{ translateX: at.x }, { translateY: at.y }],
    };
  });
  return <Animated.View style={[styles.dot, { left: cx - 3, top: cy - 3, backgroundColor: color }, dot]} />;
}

const styles = StyleSheet.create({
  root: { zIndex: 100 },
  halo: { position: 'absolute', boxShadow: '0px 0px 70px rgba(34,197,94,0.9)' },
  ring: { position: 'absolute', borderWidth: 1.5, borderStyle: 'dashed' },
  stack: { position: 'absolute', alignItems: 'center', gap: 12, zIndex: 10 },
  light: { position: 'absolute', top: 0, left: 0, backgroundImage: 'linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.75) 50%, transparent 100%)' },
  tile: {
    position: 'absolute', width: TILE, height: TILE, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 3,
    boxShadow: '0px 10px 24px rgba(22,163,74,0.22)',
  },
  greeting: { fontSize: 15, lineHeight: 20, fontWeight: '800', letterSpacing: -0.2 },
  label: { fontSize: 10.5, lineHeight: 13, fontWeight: '700', letterSpacing: -0.1 },
  wave: { position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 2, zIndex: 29 },
  dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, zIndex: 6 },
});
