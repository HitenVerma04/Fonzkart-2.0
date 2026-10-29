// The website's animated category graphics (components/sell/CategorySelector.tsx, light theme), drawn with
// react-native-svg. Same 200 × 150 drawings, colours and loops; tailwind classes are written out as colours.
import type { ComponentType, ReactNode } from 'react';
import { View } from 'react-native';
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
import { AnimatedCircle, AnimatedLine, AnimatedPath, AnimatedRect, AnimatedG as AnimatedGroup, lerp, moveDown, rotateAbout, useArtStill, useLoop, useSpin } from './motion';

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
  desktop: { x: 105, y: 62, size: 0.66 },
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

/** The drawing. While it is paused it is kept as a ready-drawn picture, so moving or tilting it costs nothing. */
function Canvas({ width, height, view, children }: ArtProps & { view: HomeTileId; children: ReactNode }) {
  const box = viewBox(view);
  const still = useArtStill();
  return (
    <View renderToHardwareTextureAndroid={still} style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} preserveAspectRatio="xMidYMid slice" fill="none">
        {children}
      </Svg>
    </View>
  );
}

/** The whole drawing bobbing up by `rise` (in drawing units) every `seconds`: the website's outer motion.g. It moves
 * the finished picture, so it keeps going while the inner parts are paused. */
function Float({ width, height, view, rise, seconds, children }: ArtProps & { view: HomeTileId; rise: number; seconds: number; children: ReactNode }) {
  const t = useLoop(seconds, 0, 'motion');
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

/** A slim flat-panel TV playing a show (a sunset over hills, a progress bar filling), a light glint gliding over the
 * glass, and a remote in front sending pulses to it. */
function SmartTvArt({ width, height }: ArtProps) {
  const play = useLoop(6);
  const glint = useSpin(5);
  const signal = useSpin(1.6);
  const progressProps = useAnimatedProps(() => ({ width: lerp(28, 104, play.value) }));
  const glintProps = useAnimatedProps(() => ({ matrix: [1, 0, -0.5, 1, lerp(-40, 190, glint.value), 0] }));
  const ring1 = useAnimatedProps(() => ({ r: 4 + signal.value * 10, opacity: 1 - signal.value }));
  const ring2 = useAnimatedProps(() => ({ r: 4 + ((signal.value + 0.5) % 1) * 10, opacity: 1 - ((signal.value + 0.5) % 1) }));
  return (
    <Float width={width} height={height} view="smarttv" rise={3} seconds={6}>
      <Defs>
        <LinearGradient id="tv-sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1e1b4b" />
          <Stop offset="0.55" stopColor="#7c3aed" />
          <Stop offset="1" stopColor="#f97316" />
        </LinearGradient>
        <ClipPath id="tv-screen">
          <Rect x="27" y="6" width="146" height="80" rx="1.5" />
        </ClipPath>
      </Defs>
      {/* feet */}
      <Path d="M 48 92 L 42 101 M 152 92 L 158 101" stroke={tw.slate600} strokeWidth="3" strokeLinecap="round" />
      {/* panel and screen */}
      <Rect x="24" y="3" width="152" height="90" rx="3" fill={tw.slate900} stroke={tw.slate700} strokeWidth="1.2" />
      <G clipPath="url(#tv-screen)">
        <Rect x="27" y="6" width="146" height="80" fill="url(#tv-sky)" />
        <Circle cx="128" cy="52" r="12" fill={tw.amber500} fillOpacity={0.9} />
        <Path d="M 27 70 Q 55 48 82 64 T 132 60 T 173 66 V 86 H 27 Z" fill="#14532d" />
        <Path d="M 27 78 Q 70 62 110 74 T 173 74 V 86 H 27 Z" fill="#052e16" />
        <Rect x="35" y="12" width="40" height="5" rx="2.5" fill={tw.white} fillOpacity={0.85} />
        <Rect x="35" y="20" width="26" height="3.5" rx="1.75" fill={tw.white} fillOpacity={0.5} />
        <Cart x={160} y={15} width={16} />
        <Rect x="35" y="79" width="104" height="2.5" rx="1.25" fill={tw.white} fillOpacity={0.3} />
        <AnimatedRect animatedProps={progressProps} x="35" y="79" width="28" height="2.5" rx="1.25" fill={tw.emerald400} />
        <AnimatedG animatedProps={glintProps}>
          <Rect x="0" y="0" width="16" height="92" fill={tw.white} fillOpacity={0.12} />
        </AnimatedG>
      </G>
      {/* chin with the power light */}
      <Rect x="96" y="89" width="8" height="1.6" rx="0.8" fill={tw.emerald400} />
      {/* the remote in front, its signal pulsing towards the TV */}
      <AnimatedCircle animatedProps={ring1} cx="130" cy="98" r="4" stroke={tw.emerald400} strokeWidth="1.2" fill="none" />
      <AnimatedCircle animatedProps={ring2} cx="130" cy="98" r="4" stroke={tw.emerald400} strokeWidth="1.2" fill="none" />
      <G transform="translate(132, 100) rotate(-30)">
        <Rect x="0" y="0" width="15" height="48" rx="7.5" fill={tw.slate800} stroke={tw.slate600} strokeWidth="1" />
        <Circle cx="7.5" cy="6" r="1.8" fill={tw.red500} />
        <Circle cx="7.5" cy="17" r="5" fill={tw.slate900} stroke={tw.slate500} strokeWidth="0.8" />
        <Circle cx="7.5" cy="17" r="1.8" fill={tw.slate600} />
        {[27, 32, 37].map(y => (
          <G key={y}>
            <Rect x="3" y={y} width="3.5" height="2.5" rx="1" fill={tw.slate600} />
            <Rect x="8.5" y={y} width="3.5" height="2.5" rx="1" fill={tw.slate600} />
          </G>
        ))}
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
        {/* keyboard: three rows of keys widening towards the front, the space bar, and the trackpad */}
        {[0, 1, 2].map(row => {
          const x0 = 10 - row * 2.4;
          const keyWidth = (124 + row * 4.8) / 14;
          return Array.from({ length: 14 }, (_, i) => (
            <Rect key={`${row}-${i}`} x={x0 + i * keyWidth} y={83.4 + row * 2.9} width={keyWidth - 1.1} height={2.1} rx={0.6} fill={tw.slate700} />
          ));
        })}
        <Rect x="50" y="92.1" width="44" height="2.1" rx="0.6" fill={tw.slate700} />
        <Rect x="60" y="94.8" width="24" height="2.6" rx="1" fill={tw.slate700} stroke={tw.slate600} strokeWidth="0.5" />
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

/** A desk setup: a monitor on its stand showing a desktop with windows and a taskbar, the cursor moving across it,
 * a keyboard and mouse in front, and a tower PC with a spinning lit fan. */
function DesktopArt({ width, height }: ArtProps) {
  const cursor = useLoop(4);
  const fan = useSpin(2.5);
  const cursorProps = useAnimatedProps(() => ({ matrix: [1, 0, 0, 1, lerp(52, 112, cursor.value), lerp(46, 22, cursor.value)] }));
  const fanProps = useAnimatedProps(() => ({ matrix: rotateAbout(360 * fan.value, 172, 46) }));
  return (
    <Float width={width} height={height} view="desktop" rise={3} seconds={5}>
      <Defs>
        <LinearGradient id="desk-wall" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#0ea5e9" />
          <Stop offset="1" stopColor="#10b981" />
        </LinearGradient>
      </Defs>
      {/* tower PC */}
      <Rect x="156" y="14" width="32" height="88" rx="4" fill={tw.slate900} stroke={tw.slate700} strokeWidth="1.2" />
      <Rect x="160" y="18" width="24" height="56" rx="2" fill={tw.slate950} />
      <Circle cx="172" cy="46" r="10" fill="none" stroke={tw.emerald500} strokeWidth="1.2" strokeOpacity={0.7} />
      <AnimatedG animatedProps={fanProps}>
        <Path d="M 172 46 L 172 38 M 172 46 L 179 50 M 172 46 L 165 50" stroke={tw.emerald400} strokeWidth="2" strokeLinecap="round" />
      </AnimatedG>
      <Circle cx="172" cy="46" r="2" fill={tw.slate700} />
      <Rect x="164" y="80" width="16" height="2" rx="1" fill={tw.slate700} />
      <Circle cx="172" cy="90" r="2.5" fill={tw.emerald400} />
      {/* monitor on its stand */}
      <Path d="M 86 76 L 82 94 H 102 L 98 76 Z" fill={tw.slate600} />
      <Rect x="70" y="93" width="44" height="4" rx="2" fill={tw.slate700} />
      <Rect x="22" y="4" width="140" height="74" rx="4" fill={tw.slate900} stroke={tw.slate700} strokeWidth="1.4" />
      <Rect x="25" y="7" width="134" height="62" rx="1.5" fill="url(#desk-wall)" />
      <Rect x="23" y="70" width="138" height="7" rx="3" fill={tw.slate300} />
      {/* windows and taskbar */}
      <Rect x="34" y="14" width="58" height="38" rx="2" fill={tw.white} fillOpacity={0.92} />
      <Rect x="34" y="14" width="58" height="6" rx="2" fill={tw.slate800} />
      <Rect x="38" y="25" width="34" height="3" rx="1.5" fill={tw.slate400} />
      <Rect x="38" y="31" width="44" height="3" rx="1.5" fill={tw.slate300} />
      <Rect x="38" y="37" width="28" height="3" rx="1.5" fill={tw.slate300} />
      <Rect x="100" y="24" width="50" height="34" rx="2" fill={tw.slate900} fillOpacity={0.85} />
      <Cart x={125} y={42} width={20} />
      <Rect x="25" y="63" width="134" height="6" fill={tw.slate900} fillOpacity={0.7} />
      {[30, 38, 46, 54].map(x => <Rect key={x} x={x} y="64.5" width="5" height="3" rx="1" fill={x === 30 ? tw.emerald400 : tw.slate400} />)}
      <AnimatedG animatedProps={cursorProps}>
        <Path d="M 0 0 L 0 9 L 2.5 6.5 L 4.5 10.5 L 6 9.8 L 4 6 L 7.5 6 Z" fill={tw.white} stroke={tw.slate900} strokeWidth="0.6" />
      </AnimatedG>
      {/* keyboard and mouse */}
      <Path d="M 40 104 H 136 L 142 120 H 34 Z" fill={tw.slate800} stroke={tw.slate600} strokeWidth="1" />
      {[0, 1, 2].map(row => (
        <Path key={row} d={`M ${43 - row * 2} ${108 + row * 4} H ${133 + row * 2}`} stroke={tw.slate500} strokeWidth="2" strokeDasharray={[4, 1.5]} />
      ))}
      <Path d="M 152 106 C 152 100, 164 100, 164 106 V 114 C 164 120, 152 120, 152 114 Z" fill={tw.slate800} stroke={tw.slate600} strokeWidth="1" />
      <Path d="M 158 101 V 107" stroke={tw.slate500} strokeWidth="0.8" />
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

/** One earbud: a glossy head with its grey ear tip, and the stem; `flip` mirrors it for the right ear. */
function Bud({ flip }: { flip?: boolean }) {
  return (
    <G transform={flip ? 'scale(-1, 1)' : undefined}>
      <Rect x="-3.5" y="6" width="7" height="26" rx="3.5" fill={tw.white} stroke={tw.slate300} strokeWidth="1" />
      <Rect x="-2.6" y="27" width="5.2" height="3" rx="1.2" fill={tw.slate300} />
      <Path d="M -9 -2 C -9 -12, 9 -14, 10 -3 C 11 6, 2 10, -2 9 C -7 8, -9 4, -9 -2 Z" fill={tw.white} stroke={tw.slate300} strokeWidth="1" />
      <Path d="M -12 -4 C -15 -4, -15 4, -12 4 L -8 3 L -8 -3 Z" fill={tw.slate400} />
      <Circle cx="3" cy="-3" r="1.4" fill={tw.slate800} />
      <Path d="M -4 -8 C -1 -10, 3 -10, 5 -8" stroke={tw.slate200} strokeWidth="1.2" strokeLinecap="round" />
    </G>
  );
}

/** One side's sound waves, growing outwards from (x, 40) and fading. */
function SoundWaves({ x, side }: { x: number; side: 1 | -1 }) {
  const t = useSpin(2.4);
  const props = useAnimatedProps(() => {
    const s = 1 + t.value * 0.4;
    return { opacity: 1 - t.value, matrix: [s, 0, 0, s, x - s * x, 40 - s * 40] };
  });
  const d = `M ${x} 30 Q ${x - 6 * side} 40 ${x} 50 M ${x + 7 * side} 25 Q ${x - 2 * side} 40 ${x + 7 * side} 55`;
  return (
    <AnimatedG animatedProps={props}>
      <Path d={d} stroke={tw.emerald400} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </AnimatedG>
  );
}

/** An open charging case with both earbuds lifting out of it in turn, sound waves either side and the green charge
 * light breathing. */
function EarbudsArt({ width, height }: ArtProps) {
  const left = useLoop(3.2);
  const right = useLoop(3.2, 1.6);
  const pulse = useLoop(2);
  const leftProps = useAnimatedProps(() => ({ matrix: rotateAbout(-14 - 4 * left.value, 80, 52, -7 * left.value) }));
  const rightProps = useAnimatedProps(() => ({ matrix: rotateAbout(14 + 4 * right.value, 120, 52, -7 * right.value) }));
  const ledProps = useAnimatedProps(() => ({ opacity: 0.35 + 0.65 * pulse.value }));
  return (
    <Float width={width} height={height} view="earbuds" rise={3} seconds={4.5}>
      <Defs>
        <LinearGradient id="bud-case" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="1" stopColor="#e2e8f0" />
        </LinearGradient>
      </Defs>
      <SoundWaves x={44} side={-1} />
      <SoundWaves x={156} side={1} />
      {/* open lid behind */}
      <Path d="M 66 64 C 66 44, 134 44, 134 64 Z" fill="url(#bud-case)" stroke={tw.slate300} strokeWidth="1.4" />
      <Path d="M 72 62 C 74 52, 126 52, 128 62" stroke={tw.slate200} strokeWidth="1.2" fill="none" />
      {/* earbuds */}
      <AnimatedG animatedProps={leftProps}>
        <G transform="translate(80, 34)"><Bud /></G>
      </AnimatedG>
      <AnimatedG animatedProps={rightProps}>
        <G transform="translate(120, 34)"><Bud flip /></G>
      </AnimatedG>
      {/* case body */}
      <Rect x="62" y="64" width="76" height="50" rx="22" fill="url(#bud-case)" stroke={tw.slate300} strokeWidth="1.6" />
      <Path d="M 66 70 H 134" stroke={tw.slate300} strokeWidth="1" />
      <AnimatedCircle animatedProps={ledProps} cx="100" cy="80" r="2.2" fill={tw.emerald500} />
      <Cart x={100} y={98} width={20} />
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
