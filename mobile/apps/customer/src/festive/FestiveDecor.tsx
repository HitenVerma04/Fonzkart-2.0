// The moving decorations on the home header while a festive theme is on: the tricolour and Ashoka Chakra for the
// national days (with kites on Independence Day), lanterns, lights and a diya for Diwali, the crescent and lanterns for
// Eid, falling snow and baubles for Christmas. Only transforms and opacity animate, and they pause with the home
// screen's other drawings. The tricolour is used as a ribbon and never as the flag itself.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { lerp, useLoop, useSpin } from '../categoryArt/motion';
import { radii, useDesign } from '../design';

const SAFFRON = '#ff9933';
const INDIA_GREEN = '#138808';
const GOLD = '#fbbf24';

export function FestiveDecor() {
  const { festive } = useDesign();
  const insets = useSafeAreaInsets();
  if (festive === 'none') return null;
  const top = insets.top;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]} accessible={false} importantForAccessibility="no-hide-descendants">
      {festive === 'republic' ? <NationalDay top={top} /> : null}
      {festive === 'independence' ? <NationalDay top={top} kites /> : null}
      {festive === 'diwali' ? <Diwali top={top} /> : null}
      {festive === 'eid' ? <Eid top={top} /> : null}
      {festive === 'christmas' ? <Christmas top={top} /> : null}
    </View>
  );
}

// ---- Shared motions ----

/** Hangs from its top edge and swings gently. */
function Sway({ seconds, degrees, delay = 0, style, children }: { seconds: number; degrees: number; delay?: number; style: object; children: ReactNode }) {
  const t = useLoop(seconds, delay, 'motion');
  const swing = useAnimatedStyle(() => ({ transform: [{ rotate: `${lerp(-degrees, degrees, t.value)}deg` }] }));
  return <Animated.View style={[styles.place, styles.hang, style, swing]}>{children}</Animated.View>;
}

/** Brightens and fades, like a light or a star. */
function Twinkle({ seconds, delay = 0, style, children }: { seconds: number; delay?: number; style: object; children: ReactNode }) {
  const t = useLoop(seconds, delay, 'motion');
  const glow = useAnimatedStyle(() => ({ opacity: lerp(0.25, 1, t.value), transform: [{ scale: lerp(0.8, 1.1, t.value) }] }));
  return <Animated.View style={[styles.place, style, glow]}>{children}</Animated.View>;
}

function Star({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 1.5c.9 6.300 3.200 9 10.500 10.500-7.300 1.500-9.600 4.200-10.500 10.500-.9-6.300-3.200-9-10.500-10.500C8.800 10.500 11.100 7.800 12 1.500z" fill={color} />
    </Svg>
  );
}

function Lantern({ body, glow, length }: { body: string; glow: string; length: number }) {
  return (
    <Svg width={30} height={length + 42} viewBox={`0 0 30 ${length + 42}`}>
      <Line x1={15} y1={0} x2={15} y2={length} stroke={glow} strokeWidth={1.2} />
      <Path d={`M9 ${length} h12 l4 8 v18 l-4 8 H9 l-4-8 V${length + 8} z`} fill={body} stroke={glow} strokeWidth={1.4} />
      <Rect x={12} y={length + 10} width={6} height={14} rx={3} fill={glow} />
      <Path d={`M15 ${length + 34} v8`} stroke={glow} strokeWidth={1.4} />
    </Svg>
  );
}

// ---- Republic Day and Independence Day ----

function Chakra({ size, color }: { size: number; color: string }) {
  const spokes = Array.from({ length: 24 }, (_, i) => (i * Math.PI) / 12);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={46} stroke={color} strokeWidth={5} fill="none" />
      <Circle cx={50} cy={50} r={8} fill={color} />
      {spokes.map(a => <Line key={a} x1={50} y1={50} x2={50 + Math.cos(a) * 46} y2={50 + Math.sin(a) * 46} stroke={color} strokeWidth={2} />)}
    </Svg>
  );
}

function Kite({ color, edge }: { color: string; edge: string }) {
  return (
    <Svg width={24} height={41} viewBox="0 0 34 58">
      <Path d="M17 1 33 19 17 39 1 19z" fill={color} stroke={edge} strokeWidth={1.2} />
      <Path d="M17 1v38M1 19h32" stroke={edge} strokeWidth={0.8} />
      <Path d="M17 39c-5 4 5 7 0 11s4 5 2 7" stroke={edge} strokeWidth={1.2} fill="none" />
    </Svg>
  );
}

function NationalDay({ top, kites }: { top: number; kites?: boolean }) {
  const turn = useSpin(26);
  const wheel = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return (
    <>
      <Animated.View style={[styles.place, styles.chakra, wheel]}><Chakra size={150} color="rgba(255,255,255,0.2)" /></Animated.View>
      {kites ? (
        <>
          <Sway seconds={3.6} degrees={9} style={{ right: 60, top: top + 56 }}><Kite color="#ffffff" edge={INDIA_GREEN} /></Sway>
          <Sway seconds={4.4} degrees={11} delay={0.5} style={{ right: 22, top: top + 58 }}><Kite color={INDIA_GREEN} edge="#ffffff" /></Sway>
        </>
      ) : (
        <>
          <Twinkle seconds={2.2} style={{ right: 84, top: top + 66 }}><Star size={16} color={SAFFRON} /></Twinkle>
          <Twinkle seconds={2.8} delay={0.5} style={{ right: 52, top: top + 84 }}><Star size={12} color="#ffffff" /></Twinkle>
          <Twinkle seconds={2.5} delay={0.9} style={{ right: 22, top: top + 64 }}><Star size={15} color="#7ee07a" /></Twinkle>
        </>
      )}
      <View style={styles.ribbon}>
        <View style={[styles.stripe, { backgroundColor: SAFFRON }]} />
        <View style={[styles.stripe, { backgroundColor: '#ffffff' }]} />
        <View style={[styles.stripe, { backgroundColor: INDIA_GREEN }]} />
      </View>
    </>
  );
}

// ---- Diwali ----

function Diya({ size }: { size: number }) {
  const t = useLoop(0.9, 0, 'motion');
  const flame = useAnimatedStyle(() => ({ opacity: lerp(0.8, 1, t.value), transform: [{ scaleY: lerp(0.86, 1.14, t.value) }, { scaleX: lerp(1.05, 0.92, t.value) }] }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      <Animated.View style={[styles.flame, flame]}>
        <Svg width={size * 0.4} height={size * 0.55} viewBox="0 0 20 28">
          <Path d="M10 0c5 8 9 12 9 18a9 9 0 0 1-18 0c0-6 4-10 9-18z" fill={GOLD} />
          <Path d="M10 11c2.500 4 4 6 4 9a4 4 0 0 1-8 0c0-3 1.500-5 4-9z" fill="#fff7d6" />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size * 0.42} viewBox="0 0 60 25">
        <Path d="M1 3c10 4 48 4 58 0-3 13-15 21-29 21S4 16 1 3z" fill="#c2570c" stroke="#fde68a" strokeWidth={1.4} />
      </Svg>
    </View>
  );
}

const LIGHTS = [GOLD, '#fb7185', '#fde68a', '#f97316', GOLD, '#fb7185', '#fde68a', '#f97316', GOLD, '#fb7185'];

function Diwali({ top }: { top: number }) {
  return (
    <>
      {LIGHTS.map((color, i) => (
        <Twinkle key={i} seconds={1.6 + (i % 3) * 0.4} delay={(i % 4) * 0.3}
          style={{ left: `${6 + i * 9.6}%`, top: Math.max(3, top - 12) + (i % 2) * 5 }}>
          <View style={[styles.bulb, { backgroundColor: color, boxShadow: `0px 0px 8px ${color}` }]} />
        </Twinkle>
      ))}
      <View style={[styles.place, { right: 18, top: top + 54 }]}><Diya size={44} /></View>
      <Twinkle seconds={2} style={{ right: 76, top: top + 66 }}><Star size={15} color={GOLD} /></Twinkle>
      <Twinkle seconds={2.6} delay={0.6} style={{ right: 8, top: top + 56 }}><Star size={11} color="#fde68a" /></Twinkle>
    </>
  );
}

// ---- Eid ----

function Crescent({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M31 3a21 21 0 1 0 14 34A18 18 0 1 1 31 3z" fill={color} />
      <Path d="m37 13 1.800 4.200 4.600.4-3.500 3 1 4.500-3.900-2.400-3.900 2.400 1-4.500-3.500-3 4.600-.4z" fill={color} />
    </Svg>
  );
}

function Eid({ top }: { top: number }) {
  const t = useLoop(4, 0, 'motion');
  const moon = useAnimatedStyle(() => ({ opacity: lerp(0.8, 1, t.value), transform: [{ translateY: lerp(-2, 2, t.value) }] }));
  return (
    <>
      <Animated.View style={[styles.place, { right: 20, top: top + 58 }, moon]}><Crescent size={48} color="#f2d98c" /></Animated.View>
      <Sway seconds={3.8} degrees={6} style={{ right: 76, top: top + 54 }}><Lantern body="#0b6b5a" glow="#f2d98c" length={4} /></Sway>
      <Twinkle seconds={2.2} style={{ right: 8, top: top + 56 }}><Star size={11} color="#f2d98c" /></Twinkle>
    </>
  );
}

// ---- Christmas ----

const FLAKES = [
  [4, 3, 0], [13, 5, 0.42], [22, 2.500, 0.7], [31, 4, 0.2], [40, 3, 0.86], [49, 5, 0.55], [58, 2.500, 0.1], [67, 4, 0.66], [76, 3, 0.33], [85, 5, 0.92], [94, 3, 0.48],
] as const;

function Flake({ clock, left, size, phase }: { clock: SharedValue<number>; left: number; size: number; phase: number }) {
  const fall = useAnimatedStyle(() => {
    const t = (clock.value + phase) % 1;
    return { transform: [{ translateY: lerp(-8, 240, t) }, { translateX: Math.sin(t * Math.PI * 4) * 6 }] };
  });
  return <Animated.View style={[styles.flake, { left: `${left}%`, width: size, height: size, borderRadius: size / 2 }, fall]} />;
}

function Tree({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 52">
      <Path d="M24 6 36 22h-6l9 12h-7l10 12H6l10-12H9l9-12h-6z" fill="#15803d" stroke="#bbf7d0" strokeWidth={1} />
      <Rect x={21} y={46} width={6} height={6} fill="#7c2d12" />
      <Circle cx={20} cy={24} r={1.800} fill={GOLD} />
      <Circle cx={29} cy={33} r={1.800} fill="#fca5a5" />
      <Circle cx={18} cy={40} r={1.800} fill={GOLD} />
      <Circle cx={32} cy={42} r={1.800} fill="#ffffff" />
    </Svg>
  );
}

function Bauble({ color, length }: { color: string; length: number }) {
  return (
    <Svg width={24} height={length + 28} viewBox={`0 0 24 ${length + 28}`}>
      <Line x1={12} y1={0} x2={12} y2={length} stroke="#ffffff" strokeWidth={1} />
      <Rect x={9} y={length} width={6} height={5} rx={1} fill={GOLD} />
      <Circle cx={12} cy={length + 15} r={11} fill={color} />
      <Circle cx={8} cy={length + 11} r={2.500} fill="rgba(255,255,255,0.6)" />
    </Svg>
  );
}

function Christmas({ top }: { top: number }) {
  const clock = useSpin(8);
  return (
    <>
      {FLAKES.map(([left, size, phase]) => <Flake key={left} clock={clock} left={left} size={size} phase={phase} />)}
      <View style={[styles.place, { right: 16, top: top + 56 }]}><Tree size={46} /></View>
      <Sway seconds={3.6} degrees={7} style={{ right: 78, top: top + 54 }}><Bauble color={GOLD} length={6} /></Sway>
    </>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', borderBottomLeftRadius: radii.xl, borderBottomRightRadius: radii.xl },
  place: { position: 'absolute' },
  hang: { transformOrigin: 'top' },
  chakra: { right: -46, bottom: -52 },
  ribbon: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  stripe: { height: 3 },
  flame: { marginBottom: -4, transformOrigin: 'bottom' },
  bulb: { width: 7, height: 7, borderRadius: 4 },
  flake: { position: 'absolute', top: 0, backgroundColor: 'rgba(255,255,255,0.85)' },
});
