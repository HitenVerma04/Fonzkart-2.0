// The website's animated category graphics (components/sell/CategorySelector.tsx, light theme), drawn with
// react-native-svg. Same 200 × 150 drawings, colours and loops; tailwind classes are written out as colours.
import type { ComponentType, ReactNode } from 'react';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  Line,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
  type GProps,
} from 'react-native-svg';
import type { SellCategoryId } from '@fonzkart/core';
import { AnimatedCircle, AnimatedLine, AnimatedPath, AnimatedRect, AnimatedG as AnimatedGroup, lerp, moveDown, rotateAbout, useLoop, useSpin } from './motion';

/** The home screen's cards: the sell categories plus the website's Repair, Screen Guard and Bulk Orders cards. */
export type HomeTileId = SellCategoryId | 'repair' | 'screenguard' | 'bulk';

// The native `matrix` prop is not in GProps (react-native-svg computes it from `transform` on the JS side).
const AnimatedG = AnimatedGroup as unknown as ComponentType<GProps & { animatedProps?: unknown }>;

// Tailwind colours the website's classes use.
const tw = {
  white: '#ffffff',
  black: '#000000',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  slate950: '#020617',
  purple400: '#c084fc',
  purple500: '#a855f7',
  purple600: '#9333ea',
  purple950: '#3b0764',
  pink400: '#f472b6',
  pink500: '#ec4899',
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue900: '#1e3a8a',
  emerald300: '#6ee7b7',
  emerald400: '#34d399',
  emerald500: '#10b981',
  emerald600: '#059669',
  emerald950: '#022c22',
  cyan400: '#22d3ee',
  cyan500: '#06b6d4',
  cyan600: '#0891b2',
  red400: '#f87171',
  red500: '#ef4444',
  orange500: '#f97316',
  orange600: '#ea580c',
  orange700: '#c2410c',
  amber500: '#f59e0b',
};

const CART = require('../../../../brand/fonzkart_cart_icon.png');
const CART_RATIO = 585 / 722;

/** The cart logo centred on (x, y), like the website's CartLogoBadge. */
function Cart({ x, y, width }: { x: number; y: number; width: number }) {
  const height = Math.round(width * CART_RATIO);
  return <SvgImage x={x - width / 2} y={y - height / 2} width={width} height={height} href={CART} preserveAspectRatio="xMidYMid meet" />;
}

type ArtProps = { width: number; height: number };

// The app shows a window of each 200 × 150 drawing centred on (x, y), the main device. At size 1 the window is
// 150 × 132, so the devices are drawn bigger than on the website and side pieces run off the card's edges; a
// smaller size shows more of the drawing, smaller (the sizes the team picked for each category).
const VIEW_WIDTH = 150;
const VIEW_HEIGHT = 132;
const VIEW: Record<HomeTileId, { x: number; y: number; size: number }> = {
  smartphone: { x: 100, y: 70, size: 0.7 },
  tablet: { x: 95, y: 78, size: 0.8 },
  camera: { x: 100, y: 80, size: 1 },
  laptop: { x: 100, y: 75, size: 0.8 },
  watch: { x: 92, y: 74, size: 0.8 },
  smarttv: { x: 100, y: 58, size: 0.8 },
  console: { x: 100, y: 62, size: 0.8 },
  desktop: { x: 105, y: 63, size: 0.8 },
  earbuds: { x: 100, y: 55, size: 0.9 },
  repair: { x: 84, y: 75, size: 0.9 },
  screenguard: { x: 100, y: 64, size: 0.8 },
  bulk: { x: 95, y: 68, size: 0.8 },
};

function viewBox(view: HomeTileId) {
  const { x, y, size } = VIEW[view];
  const width = VIEW_WIDTH / size;
  const height = VIEW_HEIGHT / size;
  return { x: x - width / 2, y: y - height / 2, width, height };
}

function Canvas({ width, height, view, children }: ArtProps & { view: HomeTileId; children: ReactNode }) {
  const box = viewBox(view);
  return (
    <Svg width={width} height={height} viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} preserveAspectRatio="xMidYMid slice" fill="none">
      {children}
    </Svg>
  );
}

/** The whole drawing bobbing up by `rise` (in drawing units) every `seconds`: the website's outer motion.g. */
function Float({ width, height, view, rise, seconds, children }: ArtProps & { view: HomeTileId; rise: number; seconds: number; children: ReactNode }) {
  const t = useLoop(seconds);
  const box = viewBox(view);
  const scale = Math.max(width / box.width, height / box.height);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -rise * t.value * scale }] }));
  return (
    <Animated.View style={style}>
      <Canvas width={width} height={height} view={view}>{children}</Canvas>
    </Animated.View>
  );
}

function SmartphoneArt({ width, height }: ArtProps) {
  // framer-motion turns SVG elements around the middle of their bounds: (48, 74) and (154, 71) for the side phones.
  const left = useLoop(4);
  const right = useLoop(4.5, 0.5);
  const hero = useLoop(3.8);
  const wave1 = useLoop(6);
  const wave2 = useLoop(5, 0.5);
  const orb = useLoop(4);
  const leftProps = useAnimatedProps(() => ({ matrix: rotateAbout(-16 - 2 * left.value, 48, 74, -3 * left.value) }));
  const rightProps = useAnimatedProps(() => ({ matrix: rotateAbout(16 + 2 * right.value, 154, 71, -4 * right.value) }));
  const heroProps = useAnimatedProps(() => ({ matrix: moveDown(-6 * hero.value) }));
  const wave1Props = useAnimatedProps(() => {
    const t = wave1.value;
    return { d: `M 3 ${lerp(42, 48, t)} C ${lerp(22, 24, t)} ${lerp(25, 35, t)}, ${lerp(38, 36, t)} ${lerp(65, 58, t)}, 61 ${lerp(38, 45, t)} L 61 120 L 3 120 Z` };
  });
  const wave2Props = useAnimatedProps(() => {
    const t = wave2.value;
    return { d: `M 3 ${lerp(68, 62, t)} C ${lerp(20, 22, t)} ${lerp(48, 55, t)}, ${lerp(42, 40, t)} ${lerp(82, 75, t)}, 61 ${lerp(62, 58, t)} L 61 120 L 3 120 Z` };
  });
  const orbProps = useAnimatedProps(() => ({ r: 20 * (1 + 0.2 * orb.value), opacity: 0.2 + 0.15 * orb.value }));

  return (
    <Canvas width={width} height={height} view="smartphone">
      <Defs>
        <LinearGradient id="sp-hero-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#030712" />
          <Stop offset="40%" stopColor="#082f49" />
          <Stop offset="75%" stopColor="#064e3b" />
          <Stop offset="100%" stopColor="#022c22" />
        </LinearGradient>
        <LinearGradient id="sp-hero-wave1" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#22d3ee" stopOpacity={0.85} />
          <Stop offset="45%" stopColor="#3b82f6" stopOpacity={0.75} />
          <Stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.35} />
        </LinearGradient>
        <LinearGradient id="sp-hero-wave2" x1="100%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
          <Stop offset="50%" stopColor="#059669" stopOpacity={0.7} />
          <Stop offset="100%" stopColor="#047857" stopOpacity={0.2} />
        </LinearGradient>
        <RadialGradient id="sp-hero-glow" cx="50%" cy="50%" r="55%">
          <Stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
          <Stop offset="60%" stopColor="#0ea5e9" stopOpacity={0.12} />
          <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="sp-glass-sheen" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.18} />
          <Stop offset="35%" stopColor="#ffffff" stopOpacity={0.04} />
          <Stop offset="60%" stopColor="#ffffff" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="sp-left-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#090514" />
          <Stop offset="60%" stopColor="#1e1b4b" />
          <Stop offset="100%" stopColor="#312e81" />
        </LinearGradient>
        <LinearGradient id="sp-left-ribbon" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#a855f7" stopOpacity={0.75} />
          <Stop offset="100%" stopColor="#6366f1" stopOpacity={0.25} />
        </LinearGradient>
        <LinearGradient id="sp-right-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#021a13" />
          <Stop offset="60%" stopColor="#064e3b" />
          <Stop offset="100%" stopColor="#065f46" />
        </LinearGradient>
        <LinearGradient id="sp-right-ribbon" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#34d399" stopOpacity={0.75} />
          <Stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.25} />
        </LinearGradient>
        <ClipPath id="sp-hero-screen-clip">
          <Rect x="3.5" y="3.5" width="57" height="115" rx="11" />
        </ClipPath>
        <ClipPath id="sp-left-screen-clip">
          <Rect x="2.5" y="2.5" width="41" height="91" rx="8" />
        </ClipPath>
        <ClipPath id="sp-right-screen-clip">
          <Rect x="2.5" y="2.5" width="43" height="93" rx="8" />
        </ClipPath>
      </Defs>

      {/* Left tilted phone */}
      <AnimatedG animatedProps={leftProps}>
        <G transform="translate(25, 26)">
          <Rect x="0" y="0" width="46" height="96" rx="11" fill={tw.slate900} stroke={tw.slate700} strokeOpacity={0.8} strokeWidth="1.5" />
          <G clipPath="url(#sp-left-screen-clip)">
            <Rect x="2.5" y="2.5" width="41" height="91" rx="8" fill="url(#sp-left-bg)" />
            <Path d="M 0 35 Q 20 20 45 50 L 45 95 L 0 95 Z" fill="url(#sp-left-ribbon)" />
            <Circle cx="20" cy="50" r="14" fill="#a855f7" fillOpacity={0.25} />
            <Circle cx="23" cy="7" r="1.5" fill="#000000" />
            <Polygon points="3,3 25,3 0,45 0,15" fill="url(#sp-glass-sheen)" />
            <SvgText x="23" y="24" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#ffffff" opacity={0.85}>09:41</SvgText>
            <Rect x="6" y="74" width="31" height="11" rx="3.5" fill="rgba(255, 255, 255, 0.12)" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.5" />
            <Circle cx="12" cy="79.5" r="2.2" fill="#818cf8" />
            <Circle cx="21.5" cy="79.5" r="2.2" fill="#c084fc" />
            <Circle cx="31" cy="79.5" r="2.2" fill="#38bdf8" />
          </G>
        </G>
      </AnimatedG>

      {/* Right tilted phone */}
      <AnimatedG animatedProps={rightProps}>
        <G transform="translate(130, 22)">
          <Rect x="0" y="0" width="48" height="98" rx="11" fill={tw.slate900} stroke={tw.slate700} strokeOpacity={0.8} strokeWidth="1.5" />
          <G clipPath="url(#sp-right-screen-clip)">
            <Rect x="2.5" y="2.5" width="43" height="93" rx="8" fill="url(#sp-right-bg)" />
            <Path d="M 0 45 Q 24 25 45 60 L 45 95 L 0 95 Z" fill="url(#sp-right-ribbon)" />
            <Circle cx="22" cy="55" r="16" fill="#10b981" fillOpacity={0.25} />
            <Circle cx="24" cy="7" r="1.5" fill="#000000" />
            <Polygon points="3,3 25,3 0,45 0,15" fill="url(#sp-glass-sheen)" />
            <SvgText x="24" y="24" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#ffffff" opacity={0.85}>09:41</SvgText>
            <Rect x="7" y="76" width="33" height="11" rx="3.5" fill="rgba(255, 255, 255, 0.12)" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.5" />
            <Circle cx="13" cy="81.5" r="2.2" fill="#34d399" />
            <Circle cx="23.5" cy="81.5" r="2.2" fill="#38bdf8" />
            <Circle cx="34" cy="81.5" r="2.2" fill="#fbbf24" />
          </G>
        </G>
      </AnimatedG>

      {/* Centre flagship phone */}
      <AnimatedG animatedProps={heroProps}>
        <G transform="translate(68, 12)">
          <Rect x="0" y="0" width="64" height="122" rx="15" fill={tw.slate950} stroke={tw.slate700} strokeOpacity={0.8} strokeWidth="1.8" />
          <Rect x="2" y="2" width="60" height="118" rx="13" fill="none" stroke={tw.white} strokeOpacity={0.1} strokeWidth="0.8" />
          <G clipPath="url(#sp-hero-screen-clip)">
            <Rect x="3.5" y="3.5" width="57" height="115" rx="11" fill="url(#sp-hero-bg)" />
            <Rect x="3.5" y="3.5" width="57" height="115" fill="url(#sp-hero-glow)" />
            <AnimatedPath animatedProps={wave1Props} d="M 3 42 C 22 25, 38 65, 61 38 L 61 120 L 3 120 Z" fill="url(#sp-hero-wave1)" />
            <AnimatedPath animatedProps={wave2Props} d="M 3 68 C 20 48, 42 82, 61 62 L 61 120 L 3 120 Z" fill="url(#sp-hero-wave2)" />
            <AnimatedCircle animatedProps={orbProps} cx="32" cy="58" r="20" fill="#10b981" fillOpacity={0.2} />
            <Polygon points="4,4 42,4 4,80" fill="url(#sp-glass-sheen)" />
            <SvgText x="8.5" y="10.8" fontSize="4.5" fontWeight="700" fill="#ffffff" opacity={0.95}>9:41</SvgText>
            <G transform="translate(43, 7.5)">
              <Path d="M 0 3.5 Q 2.5 1.2 5 3.5" stroke="#ffffff" strokeWidth="0.6" strokeLinecap="round" fill="none" opacity={0.85} />
              <Path d="M 1 4.5 Q 2.5 3 4 4.5" stroke="#ffffff" strokeWidth="0.6" strokeLinecap="round" fill="none" opacity={0.85} />
              <Rect x="7" y="0.8" width="6" height="3.2" rx="1" stroke="#ffffff" strokeWidth="0.5" fill="none" opacity={0.85} />
              <Rect x="7.8" y="1.5" width="3.5" height="1.8" rx="0.5" fill="#10b981" />
            </G>
            <Rect x="22" y="6.5" width="20" height="5" rx="2.5" fill="#000000" />
            <Circle cx="37" cy="9" r="1" fill="#0284c7" opacity={0.8} />
            <G transform="translate(8, 20)">
              <Rect x="0" y="0" width="48" height="42" rx="8" fill="rgba(255, 255, 255, 0.09)" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="0.8" />
              <Cart x={24} y={18} width={26} />
              <Rect x="6" y="31.5" width="36" height="7.5" rx="3.75" fill="rgba(16, 185, 129, 0.25)" stroke="rgba(52, 211, 153, 0.5)" strokeWidth="0.6" />
              <SvgText x="24" y="36.8" textAnchor="middle" fontSize="3.6" fontWeight="800" fill="#34d399" letterSpacing="0.4">INSTANT CASH</SvgText>
            </G>
            <G transform="translate(8, 86)">
              <Rect x="0" y="0" width="48" height="19" rx="6" fill="rgba(255, 255, 255, 0.12)" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="0.8" />
              <Rect x="4" y="4" width="8" height="8" rx="2.5" fill="#10b981" />
              <Rect x="15" y="4" width="8" height="8" rx="2.5" fill="#3b82f6" />
              <Rect x="26" y="4" width="8" height="8" rx="2.5" fill="#06b6d4" />
              <Rect x="37" y="4" width="8" height="8" rx="2.5" fill="#f59e0b" />
            </G>
            <Rect x="22" y="112" width="20" height="1.8" rx="0.9" fill="#ffffff" opacity={0.85} />
          </G>
        </G>
      </AnimatedG>
    </Canvas>
  );
}

const TABLET_WAVE_LENGTH = 130.95; // length of the wave path below, for drawing part of it

function TabletArt({ width, height }: ArtProps) {
  const wave = useLoop(3.5);
  const pen = useLoop(2.5);
  // pathLength 0.3 → 1 → 0.3 of the wave.
  const waveProps = useAnimatedProps(() => ({ strokeDashoffset: TABLET_WAVE_LENGTH * (1 - lerp(0.3, 1, wave.value)) }));
  // On the website the stylus's own translate/rotate is replaced by its animation, so it lies flat at the tablet's corner.
  const penProps = useAnimatedProps(() => ({ matrix: moveDown(-4 * pen.value) }));
  return (
    <Float width={width} height={height} view="tablet" rise={5} seconds={5}>
      <Defs>
        <ClipPath id="tablet-clip-screen">
          <Rect x="4" y="4" width="116" height="88" rx="7" />
        </ClipPath>
      </Defs>
      <G transform="translate(68, 20) rotate(10)">
        <Rect x="0" y="0" width="92" height="118" rx="10" fill={tw.slate800} fillOpacity={0.7} stroke={tw.slate700} strokeWidth="1.5" />
        <Rect x="4" y="4" width="84" height="110" rx="7" fill={tw.purple950} fillOpacity={0.4} />
      </G>
      <G transform="translate(30, 26)">
        <Rect x="0" y="0" width="124" height="96" rx="10" fill={tw.slate900} stroke={tw.slate700} strokeWidth="2" />
        <Rect x="4" y="4" width="116" height="88" rx="7" fill={tw.slate950} />
        <G clipPath="url(#tablet-clip-screen)">
          <Circle cx="60" cy="50" r="38" fill={tw.purple600} fillOpacity={0.3} />
          <Circle cx="90" cy="58" r="28" fill={tw.pink500} fillOpacity={0.25} />
          <AnimatedPath
            animatedProps={waveProps}
            d="M 10 65 Q 40 25 70 50 T 114 35"
            stroke={tw.purple400}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={[TABLET_WAVE_LENGTH, TABLET_WAVE_LENGTH]}
          />
          <Rect x="8" y="10" width="22" height="65" rx="4" fill={tw.slate800} fillOpacity={0.8} stroke={tw.slate700} strokeWidth="1" />
          <Circle cx="19" cy="20" r="4" fill={tw.purple400} />
          <Circle cx="19" cy="32" r="4" fill={tw.pink400} />
          <Circle cx="19" cy="44" r="4" fill={tw.blue400} />
          <Rect x="13" y="54" width="12" height="3" rx="1.5" fill={tw.emerald400} />
          <Cart x={105} y={16} width={22} />
        </G>
        <AnimatedG animatedProps={penProps}>
          <Rect x="0" y="0" width="55" height="5" rx="2.5" fill={tw.white} stroke={tw.slate300} strokeWidth="1" />
          <Polygon points="55,0 60,2.5 55,5" fill={tw.slate800} />
        </AnimatedG>
      </G>
    </Float>
  );
}

function WatchArt({ width, height }: ArtProps) {
  const red = useSpin(6);
  const green = useSpin(5);
  const redProps = useAnimatedProps(() => ({ matrix: rotateAbout(360 * red.value, 32, 52) }));
  const greenProps = useAnimatedProps(() => ({ matrix: rotateAbout(-360 * green.value, 32, 52) }));
  return (
    <Float width={width} height={height} view="watch" rise={5} seconds={5}>
      <G transform="translate(35, 25) rotate(-8)">
        <Path d="M 20 0 V 22 M 20 78 V 100" stroke="#475569" strokeWidth="32" strokeLinecap="round" fill="none" />
        <Rect x="0" y="20" width="40" height="60" rx="10" fill={tw.slate900} stroke={tw.slate700} strokeWidth="2" />
        <Rect x="4" y="24" width="32" height="52" rx="6" fill={tw.black} />
        <Circle cx="20" cy="50" r="10" stroke={tw.orange500} strokeWidth="2.5" fill="none" />
        <SvgText x="20" y="53" textAnchor="middle" fill="#f97316" fontSize="5" fontWeight="bold" fontFamily="monospace">8,420</SvgText>
      </G>
      <G transform="translate(100, 20)">
        <Path d="M 32 0 V 24 M 32 80 V 104" stroke="#ea580c" strokeWidth="36" strokeLinecap="round" fill="none" />
        <Rect x="2" y="20" width="60" height="64" rx="16" fill={tw.slate900} stroke={tw.slate700} strokeWidth="2.5" />
        <Rect x="6" y="24" width="52" height="56" rx="12" fill={tw.black} />
        <Rect x="62" y="34" width="4" height="14" rx="2" fill={tw.slate600} />
        <Circle cx="32" cy="52" r="18" stroke={tw.red500} strokeOpacity={0.4} strokeWidth="3" fill="none" />
        <Circle cx="32" cy="52" r="14" stroke={tw.emerald500} strokeOpacity={0.4} strokeWidth="3" fill="none" />
        <AnimatedG animatedProps={redProps}>
          <Circle cx="32" cy="52" r="18" stroke={tw.red500} strokeWidth="3" fill="none" strokeDasharray={[60, 120]} />
        </AnimatedG>
        <AnimatedG animatedProps={greenProps}>
          <Circle cx="32" cy="52" r="14" stroke={tw.emerald400} strokeWidth="3" fill="none" strokeDasharray={[45, 100]} />
        </AnimatedG>
        <Cart x={31} y={52} width={18} />
      </G>
    </Float>
  );
}

function ConsoleArt({ width, height }: ArtProps) {
  return (
    <Float width={width} height={height} view="console" rise={5} seconds={5.5}>
      <G transform="translate(14, 22) rotate(-10)">
        <Path d="M 0 0 Q 4 42 0 84 H 18 Q 14 42 18 0 Z" fill={tw.white} stroke={tw.slate300} strokeWidth="1.2" />
        <Rect x="3" y="4" width="12" height="76" rx="2" fill={tw.slate900} />
        <Line x1="5" y1="10" x2="5" y2="72" stroke={tw.cyan400} strokeWidth="1.2" />
      </G>
      <G transform="translate(170, 22) rotate(10)">
        <Rect x="0" y="0" width="18" height="84" rx="4" fill={tw.slate900} stroke={tw.slate700} strokeWidth="1.5" />
        <Circle cx="9" cy="14" r="3.5" fill={tw.emerald500} stroke={tw.emerald300} strokeWidth="1" />
        <Line x1="4" y1="32" x2="14" y2="32" stroke={tw.slate600} strokeWidth="1.2" />
        <Line x1="4" y1="46" x2="14" y2="46" stroke={tw.slate600} strokeWidth="1.2" />
      </G>
      <G transform="translate(42, 36) rotate(-6)">
        <Rect x="0" y="0" width="34" height="52" rx="6" fill={tw.slate800} stroke={tw.slate600} strokeWidth="1.2" />
        <Rect x="3" y="10" width="28" height="32" rx="3" fill={tw.slate950} />
        <Circle cx="17" cy="26" r="8" fill={tw.blue500} fillOpacity={0.3} />
      </G>
      <G transform="translate(124, 36) rotate(6)">
        <Rect x="0" y="0" width="34" height="52" rx="6" fill={tw.slate800} stroke={tw.slate600} strokeWidth="1.2" />
        <Rect x="3" y="10" width="28" height="32" rx="3" fill={tw.slate950} />
        <Circle cx="17" cy="26" r="8" fill={tw.pink500} fillOpacity={0.3} />
      </G>
      <G transform="translate(62, 38)">
        <Path
          d="M 8 56 C 0 48 -4 22 4 10 C 10 0 24 -2 36 2 C 42 4 50 4 56 2 C 68 -2 82 0 88 10 C 96 22 92 48 84 56 C 74 64 64 46 54 36 C 50 32 42 32 38 36 C 28 46 18 64 8 56 Z"
          fill={tw.slate900}
          stroke={tw.slate700}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <Rect x="33" y="4" width="26" height="15" rx="2" fill={tw.slate800} stroke={tw.slate600} strokeWidth="0.8" />
        <Cart x={46} y={11} width={15} />
        <G transform="translate(20, 20)">
          <Rect x="-2" y="-6" width="4" height="12" rx="1" fill={tw.slate700} />
          <Rect x="-6" y="-2" width="12" height="4" rx="1" fill={tw.slate700} />
        </G>
        <G transform="translate(72, 20)">
          <Circle cx="0" cy="-4" r="2" fill={tw.emerald500} />
          <Circle cx="4" cy="0" r="2" fill={tw.red500} />
          <Circle cx="0" cy="4" r="2" fill={tw.blue500} />
          <Circle cx="-4" cy="0" r="2" fill={tw.amber500} />
        </G>
        <G transform="translate(32, 30)">
          <Circle cx="0" cy="0" r="7" fill={tw.slate800} stroke={tw.slate600} strokeWidth="1.2" />
          <Circle cx="0" cy="0" r="3.5" fill={tw.slate900} />
        </G>
        <G transform="translate(60, 30)">
          <Circle cx="0" cy="0" r="7" fill={tw.slate800} stroke={tw.slate600} strokeWidth="1.2" />
          <Circle cx="0" cy="0" r="3.5" fill={tw.slate900} />
        </G>
      </G>
    </Float>
  );
}

function SideTv({ transform, glow }: { transform: string; glow: string }) {
  return (
    <G transform={transform}>
      <Path d="M 28 42 V 50 M 20 50 H 36" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <Rect x="0" y="0" width="56" height="34" rx="2" fill={tw.slate900} stroke={tw.slate700} strokeWidth="1.5" />
      <Rect x="2" y="2" width="52" height="30" rx="1.5" fill={tw.slate950} />
      <Circle cx="28" cy="17" r="10" fill={glow} fillOpacity={0.3} />
      <Polygon points="25,14 33,17 25,20" fill={tw.white} />
    </G>
  );
}

function SmartTvArt({ width, height }: ArtProps) {
  return (
    <Float width={width} height={height} view="smarttv" rise={4} seconds={6}>
      <SideTv transform="translate(15, 34) rotate(-12)" glow={tw.blue500} />
      <SideTv transform="translate(130, 34) rotate(12)" glow={tw.purple500} />
      <G transform="translate(48, 18)">
        <Path d="M 35 72 L 69 72 L 75 80 H 29 Z" fill={tw.slate700} />
        <Rect x="49" y="60" width="6" height="12" fill={tw.slate600} />
        <Rect x="0" y="0" width="104" height="62" rx="3" fill={tw.slate900} stroke={tw.slate700} strokeWidth="2" />
        <Rect x="2.5" y="2.5" width="99" height="57" rx="2" fill={tw.slate950} />
        <Circle cx="52" cy="30" r="28" fill={tw.emerald500} fillOpacity={0.2} />
        <Rect x="8" y="8" width="26" height="18" rx="2" fill={tw.red500} fillOpacity={0.4} stroke={tw.red400} strokeWidth="0.6" />
        <Polygon points="19,17 23,19 19,21" fill={tw.white} />
        <Cart x={50} y={18} width={22} />
        <Rect x="70" y="8" width="26" height="18" rx="2" fill={tw.emerald500} fillOpacity={0.4} stroke={tw.emerald400} strokeWidth="0.6" />
        {[8, 26, 44, 62, 80].map(x => (
          <Rect key={x} x={x} y="32" width="14" height="8" rx="1.5" fill={tw.slate800} />
        ))}
      </G>
      <G transform="translate(172, 32) rotate(14)">
        <Rect x="0" y="0" width="12" height="46" rx="5" fill={tw.slate900} stroke={tw.slate700} strokeWidth="1.2" />
        <Circle cx="6" cy="6" r="2" fill={tw.red500} />
        <Circle cx="6" cy="16" r="4" fill={tw.slate800} stroke={tw.slate600} strokeWidth="0.8" />
        <Rect x="2.5" y="26" width="7" height="2.5" rx="1" fill={tw.emerald500} />
        <Rect x="2.5" y="31" width="7" height="2.5" rx="1" fill={tw.blue500} />
      </G>
    </Float>
  );
}

/** One code line in the laptop's editor, its width going from..to..from every `seconds`. */
function CodeLine({ y, from, to, seconds, delay, color }: { y: number; from: number; to: number; seconds: number; delay: number; color: string }) {
  const t = useLoop(seconds, delay);
  const props = useAnimatedProps(() => ({ width: lerp(from, to, t.value) }));
  return <AnimatedRect animatedProps={props} x="30" y={y} width={from} height="4" rx="2" fill={color} />;
}

function LaptopArt({ width, height }: ArtProps) {
  return (
    <Float width={width} height={height} view="laptop" rise={4} seconds={5}>
      <Defs>
        <ClipPath id="laptop-clip-web">
          <Rect x="22" y="12" width="100" height="66" rx="3" />
        </ClipPath>
      </Defs>
      <G transform="translate(28, 22)">
        <Path d="M 5 82 L 139 82 L 148 98 H -4 Z" fill={tw.slate800} stroke={tw.slate600} strokeWidth="1.5" />
        <Rect x="52" y="86" width="40" height="5" rx="2" fill={tw.slate600} />
        <Rect x="18" y="8" width="108" height="74" rx="6" fill={tw.slate900} stroke={tw.slate700} strokeWidth="2" />
        <Rect x="22" y="12" width="100" height="66" rx="3" fill={tw.slate950} />
        <G clipPath="url(#laptop-clip-web)">
          <Rect x="22" y="12" width="100" height="10" fill={tw.slate900} />
          <Circle cx="28" cy="17" r="2" fill={tw.red500} />
          <Circle cx="34" cy="17" r="2" fill={tw.amber500} />
          <Circle cx="40" cy="17" r="2" fill={tw.emerald500} />
          <CodeLine y={28} from={20} to={38} seconds={3} delay={0} color={tw.emerald400} />
          <CodeLine y={36} from={25} to={45} seconds={3.5} delay={0.3} color={tw.cyan400} />
          <CodeLine y={44} from={20} to={40} seconds={4} delay={0.6} color={tw.blue400} />
          <CodeLine y={52} from={30} to={48} seconds={4.5} delay={0.9} color={tw.purple400} />
          <Cart x={96} y={44} width={24} />
        </G>
      </G>
    </Float>
  );
}

function DesktopArt({ width, height }: ArtProps) {
  const orbit = useSpin(8);
  const orbitProps = useAnimatedProps(() => ({ matrix: rotateAbout(360 * orbit.value, 63, 20) }));
  return (
    <Float width={width} height={height} view="desktop" rise={4} seconds={5}>
      <G transform="translate(18, 38) rotate(-10)">
        <Path d="M 28 36 V 46 M 18 46 H 38" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <Rect x="0" y="0" width="56" height="36" rx="3" fill={tw.slate900} stroke={tw.slate700} strokeWidth="1.2" />
        <Rect x="2" y="2" width="52" height="32" rx="1.5" fill={tw.slate950} />
        <Circle cx="20" cy="18" r="9" fill={tw.blue600} fillOpacity={0.3} stroke={tw.blue500} strokeOpacity={0.5} strokeWidth="1" />
        <Circle cx="20" cy="18" r="4" fill={tw.blue500} />
        <Line x1="20" y1="18" x2="44" y2="14" stroke={tw.emerald400} strokeWidth="1.2" />
      </G>
      <G transform="translate(126, 40) rotate(8)">
        <Path d="M 28 36 V 46 M 18 46 H 38" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <Rect x="0" y="0" width="56" height="36" rx="3" fill={tw.slate900} stroke={tw.slate700} strokeWidth="1.2" />
        <Rect x="2" y="2" width="52" height="32" rx="1.5" fill={tw.slate950} />
        <Circle cx="36" cy="18" r="9" stroke={tw.emerald400} strokeOpacity={0.6} strokeWidth="1" strokeDasharray={[2, 2]} fill="none" />
      </G>
      <G transform="translate(52, 26)">
        <Path d="M 44 50 V 62 M 32 62 H 56" stroke="#475569" strokeWidth="3" strokeLinecap="round" fill="none" />
        <Rect x="0" y="0" width="88" height="52" rx="4" fill={tw.slate900} stroke={tw.emerald500} strokeWidth="1.8" />
        <Rect x="2.5" y="2.5" width="83" height="47" rx="2" fill={tw.slate950} />
        <Circle cx="25" cy="26" r="12" fill={tw.blue900} fillOpacity={0.4} stroke={tw.blue600} strokeWidth="1.2" />
        <Circle cx="25" cy="26" r="6" fill={tw.blue500} />
        <Line x1="25" y1="26" x2="63" y2="20" stroke={tw.emerald400} strokeWidth="1.8" />
        <Circle cx="44" cy="23" r="2" fill={tw.emerald400} />
        <AnimatedG animatedProps={orbitProps}>
          <Circle cx="63" cy="20" r="14" stroke={tw.emerald400} strokeWidth="1.2" strokeDasharray={[3, 3]} fill="none" />
        </AnimatedG>
        <Cart x={63} y={20} width={18} />
      </G>
      <G transform="translate(138, 28)">
        <Rect x="0" y="0" width="22" height="58" rx="3" fill={tw.slate900} stroke={tw.emerald500} strokeWidth="1.5" />
        <Circle cx="11" cy="14" r="4.5" fill={tw.blue500} stroke={tw.cyan400} strokeWidth="1" />
        <Line x1="6" y1="28" x2="16" y2="28" stroke={tw.slate600} strokeWidth="1" />
        <Line x1="6" y1="32" x2="16" y2="32" stroke={tw.slate600} strokeWidth="1" />
        <Line x1="6" y1="36" x2="16" y2="36" stroke={tw.slate600} strokeWidth="1" />
        <Circle cx="11" cy="48" r="1.5" fill={tw.emerald400} />
      </G>
      <G transform="translate(174, 40) rotate(6)">
        <Rect x="0" y="0" width="18" height="54" rx="3" fill={tw.slate900} stroke={tw.slate700} strokeWidth="1.2" />
        <Circle cx="9" cy="13" r="3.5" fill={tw.blue500} stroke={tw.cyan400} strokeWidth="0.8" />
        <Line x1="5" y1="26" x2="13" y2="26" stroke={tw.slate600} strokeWidth="0.8" />
        <Line x1="5" y1="30" x2="13" y2="30" stroke={tw.slate600} strokeWidth="0.8" />
      </G>
    </Float>
  );
}

function CameraArt({ width, height }: ArtProps) {
  return (
    <Float width={width} height={height} view="camera" rise={5} seconds={4}>
      <G transform="translate(45, 40)">
        <Rect x="0" y="10" width="110" height="70" rx="8" fill={tw.slate800} stroke={tw.slate600} strokeWidth="2" />
        <Rect x="20" y="0" width="30" height="10" rx="2" fill={tw.slate700} stroke={tw.slate500} strokeWidth="2" />
        <Circle cx="55" cy="45" r="25" fill={tw.slate900} stroke={tw.slate500} strokeWidth="4" />
        <Circle cx="55" cy="45" r="16" fill={tw.black} stroke={tw.slate700} strokeWidth="1.5" />
        <Circle cx="55" cy="45" r="10" fill={tw.slate900} stroke={tw.blue600} strokeWidth="1.2" />
        <Circle cx="55" cy="45" r="5" fill={tw.black} />
        <Circle cx="50" cy="40" r="4" fill={tw.white} fillOpacity={0.3} />
        <Circle cx="15" cy="24" r="4" fill={tw.red500} />
        <Cart x={94} y={24} width={22} />
      </G>
    </Float>
  );
}

/** A small earbud standing in a side case, at (x, -12) of the case. */
function SmallBud({ x, fill, stroke }: { x: number; fill: string; stroke: string }) {
  return (
    <G transform={`translate(${x}, -12)`}>
      <Rect x="-1.5" y="0" width="3" height="12" rx="1.5" fill={fill} stroke={stroke} strokeWidth="0.8" />
      <Circle cx="0" cy="0" r="3.5" fill={fill} stroke={stroke} strokeWidth="0.8" />
    </G>
  );
}

function WhiteBud({ x }: { x: number }) {
  return (
    <G transform={`translate(${x}, 6)`}>
      <Rect x="2" y="6" width="5" height="18" rx="2.5" fill={tw.white} stroke={tw.slate300} strokeWidth="1.2" />
      <Circle cx="4.5" cy="6" r="5.5" fill={tw.white} stroke={tw.slate300} strokeWidth="1.2" />
      <Circle cx="4.5" cy="6" r="2" fill={tw.slate900} />
    </G>
  );
}

function EarbudsArt({ width, height }: ArtProps) {
  return (
    <Float width={width} height={height} view="earbuds" rise={4} seconds={4.5}>
      <G transform="translate(24, 48) rotate(-12)">
        <SmallBud x={8} fill={tw.slate800} stroke={tw.slate600} />
        <SmallBud x={22} fill={tw.slate800} stroke={tw.slate600} />
        <Rect x="0" y="0" width="30" height="24" rx="8" fill={tw.slate900} stroke={tw.slate700} strokeWidth="1.2" />
        <Path d="M 0 8 Q 15 12 30 8" stroke="#334155" strokeWidth="1" fill="none" />
        <Circle cx="15" cy="16" r="1.5" fill={tw.cyan400} />
      </G>
      <G transform="translate(144, 42) rotate(12)">
        <SmallBud x={8} fill={tw.slate700} stroke={tw.slate500} />
        <SmallBud x={22} fill={tw.slate700} stroke={tw.slate500} />
        <Rect x="0" y="0" width="30" height="24" rx="8" fill={tw.slate800} stroke={tw.slate600} strokeWidth="1.2" />
        <Path d="M 0 8 Q 15 12 30 8" stroke="#475569" strokeWidth="1" fill="none" />
        <Circle cx="15" cy="16" r="1.5" fill={tw.emerald400} />
      </G>
      <G transform="translate(74, 28)">
        <WhiteBud x={12} />
        <WhiteBud x={36} />
        <Rect x="0" y="24" width="54" height="42" rx="14" fill={tw.white} stroke={tw.slate300} strokeWidth="1.8" />
        <Path d="M 0 38 Q 27 44 54 38" stroke={tw.slate200} strokeWidth="1.2" fill="none" />
        <Cart x={27} y={50} width={18} />
      </G>
    </Float>
  );
}

function RepairArt({ width, height }: ArtProps) {
  const scan = useLoop(2.5);
  const tool = useLoop(2);
  const scanProps = useAnimatedProps(() => ({ y1: 20 + 80 * scan.value, y2: 20 + 80 * scan.value }));
  // On the website the screwdriver's own translate/rotate is replaced by its animation, so it sits at the corner.
  const toolProps = useAnimatedProps(() => ({ matrix: moveDown(-4 * tool.value) }));
  return (
    <Float width={width} height={height} view="repair" rise={5} seconds={5}>
      <G transform="translate(50, 20)">
        <Rect x="0" y="0" width="68" height="110" rx="12" fill={tw.slate900} stroke={tw.slate700} strokeWidth="2" />
        <Rect x="4" y="4" width="60" height="102" rx="9" fill={tw.slate950} />
        <Rect x="10" y="15" width="48" height="40" rx="4" fill={tw.emerald950} fillOpacity={0.6} stroke={tw.emerald600} strokeOpacity={0.4} strokeWidth="1" />
        <Cart x={34} y={35} width={22} />
        <AnimatedLine animatedProps={scanProps} x1="4" y1="20" x2="64" y2="20" stroke={tw.cyan400} strokeWidth="2" />
      </G>
      <AnimatedG animatedProps={toolProps}>
        <Rect x="-4" y="0" width="8" height="28" rx="2" fill={tw.orange600} stroke={tw.orange700} strokeWidth="1" />
        <Rect x="-2" y="28" width="4" height="35" fill={tw.slate300} stroke={tw.slate400} strokeWidth="1" />
        <Polygon points="-3,63 3,63 0,72" fill={tw.slate700} />
      </AnimatedG>
    </Float>
  );
}

function GuardedPhone({ transform, glass, glow }: { transform: string; glass: string; glow: string }) {
  return (
    <G transform={transform}>
      <Rect x="0" y="0" width="38" height="78" rx="8" fill={tw.slate900} stroke={tw.slate700} strokeWidth="1.2" />
      <Rect x="2" y="2" width="34" height="74" rx="6" fill={tw.slate950} />
      <Rect x="2" y="2" width="34" height="74" rx="6" fill={glass} fillOpacity={0.2} stroke={glow} strokeWidth="0.8" />
      <Circle cx="19" cy="38" r="8" fill={glass === tw.cyan500 ? tw.cyan600 : tw.emerald600} />
      <SvgText x="19" y="41" textAnchor="middle" fill="#ffffff" fontSize="6" fontWeight="bold">9H</SvgText>
    </G>
  );
}

function ScreenGuardArt({ width, height }: ArtProps) {
  const guard = useLoop(2.5);
  const guardProps = useAnimatedProps(() => ({ y: 2 - 3 * guard.value }));
  return (
    <Float width={width} height={height} view="screenguard" rise={4} seconds={4}>
      <GuardedPhone transform="translate(30, 28) rotate(-16)" glass={tw.cyan500} glow={tw.cyan400} />
      <GuardedPhone transform="translate(132, 20) rotate(16)" glass={tw.emerald500} glow={tw.emerald400} />
      <G transform="translate(76, 14)">
        <Rect x="0" y="0" width="48" height="96" rx="11" fill={tw.slate900} stroke={tw.emerald500} strokeWidth="2" />
        <Rect x="3" y="3" width="42" height="90" rx="9" fill={tw.slate950} />
        <Rect x="16" y="6" width="16" height="4" rx="2" fill={tw.black} />
        <Circle cx="24" cy="48" r="20" fill={tw.emerald600} fillOpacity={0.3} />
        <AnimatedRect animatedProps={guardProps} x="2" y="2" width="44" height="92" rx="8" fill={tw.cyan400} fillOpacity={0.25} stroke={tw.cyan400} strokeWidth="1.2" />
        <Cart x={24} y={38} width={22} />
      </G>
    </Float>
  );
}

function BulkArt({ width, height }: ArtProps) {
  // On the website the badge's translate is replaced by its spin, so the ring turns around the drawing's corner
  // while the ♻ centre stays at (144, 88).
  const spin = useSpin(24);
  const ringProps = useAnimatedProps(() => ({ matrix: rotateAbout(360 * spin.value, 0, 0) }));
  return (
    <Float width={width} height={height} view="bulk" rise={4} seconds={4}>
      <Defs>
        <LinearGradient id="bulk-laptop-screen" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#022c22" />
          <Stop offset="50%" stopColor="#064e3b" />
          <Stop offset="100%" stopColor="#020617" />
        </LinearGradient>
      </Defs>
      <G transform="translate(32, 18)">
        <Rect x="0" y="0" width="104" height="68" rx="6" fill={tw.slate900} stroke={tw.slate700} strokeWidth="1.5" />
        <Rect x="4" y="4" width="96" height="60" rx="4" fill="url(#bulk-laptop-screen)" />
        <G transform="translate(10, 12)">
          <Rect x="0" y="24" width="7" height="20" rx="2" fill="#10b981" opacity={0.6} />
          <Rect x="10" y="16" width="7" height="28" rx="2" fill="#10b981" opacity={0.8} />
          <Rect x="20" y="6" width="7" height="38" rx="2" fill="#34d399" />
          <Rect x="30" y="18" width="7" height="26" rx="2" fill="#059669" opacity={0.7} />
          <Rect x="45" y="10" width="36" height="5" rx="2" fill="#ffffff" opacity={0.3} />
          <Rect x="45" y="20" width="26" height="4" rx="2" fill="#34d399" opacity={0.7} />
          <Rect x="45" y="28" width="30" height="4" rx="2" fill="#ffffff" opacity={0.2} />
          <Rect x="45" y="36" width="20" height="4" rx="2" fill="#10b981" opacity={0.5} />
        </G>
        <Path d="M -12 68 L 116 68 L 106 76 L -2 76 Z" fill={tw.slate800} stroke={tw.slate700} strokeWidth="1.2" />
        <Rect x="42" y="68" width="22" height="2.5" rx="1" fill="#475569" />
      </G>
      <G transform="translate(98, 42) rotate(8)">
        <Rect x="0" y="0" width="46" height="64" rx="6" fill={tw.slate900} stroke={tw.emerald600} strokeOpacity={0.7} strokeWidth="1.5" />
        <Rect x="2.5" y="2.5" width="41" height="59" rx="4" fill={tw.slate950} />
        <Rect x="6" y="8" width="34" height="20" rx="3" fill="#10b981" fillOpacity={0.15} />
        <Circle cx="23" cy="18" r="6" fill="#10b981" fillOpacity={0.3} />
      </G>
      <G transform="translate(72, 50) rotate(-6)">
        <Rect x="0" y="0" width="36" height="68" rx="8" fill={tw.slate950} stroke={tw.emerald500} strokeWidth="1.8" />
        <Rect x="2" y="2" width="32" height="64" rx="6" fill={tw.slate950} />
        <Rect x="12" y="4.5" width="12" height="3" rx="1.5" fill="#000000" />
        <Circle cx="18" cy="34" r="12" fill="#10b981" fillOpacity={0.2} />
        <Cart x={18} y={32} width={18} />
      </G>
      <AnimatedG animatedProps={ringProps}>
        <Circle cx="0" cy="0" r="18" fill="#064e3b" stroke="#10b981" strokeWidth="2" />
        <Path d="M 0 -11 L 3 -6 L -3 -6 Z" fill="#34d399" />
        <Path d="M 0 -10 A 10 10 0 0 1 9 4" fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" />
        <Path d="M 9 4 L 11 -1 L 6 1 Z" fill="#34d399" />
        <Path d="M 9 4 A 10 10 0 0 1 -9 4" fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" />
        <Path d="M -9 4 L -6 9 L -4 4 Z" fill="#34d399" />
        <Path d="M -9 4 A 10 10 0 0 1 0 -10" fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" />
      </AnimatedG>
      <G transform="translate(144, 88)">
        <Circle cx="0" cy="0" r="7" fill="#10b981" />
        <SvgText x="0" y="2.5" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#022c22">♻</SvgText>
      </G>
    </Float>
  );
}

export const CATEGORY_ART: Record<HomeTileId, ComponentType<ArtProps>> = {
  smartphone: SmartphoneArt,
  tablet: TabletArt,
  camera: CameraArt,
  laptop: LaptopArt,
  watch: WatchArt,
  smarttv: SmartTvArt,
  console: ConsoleArt,
  desktop: DesktopArt,
  earbuds: EarbudsArt,
  repair: RepairArt,
  screenguard: ScreenGuardArt,
  bulk: BulkArt,
};
