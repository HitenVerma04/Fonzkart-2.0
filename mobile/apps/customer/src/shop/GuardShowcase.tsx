// The picture on a screen guard card: the phone standing still, turned a little, and its guard floating in front of
// it, drifting towards and away from the screen while a glint crosses the glass. The phone is drawn here rather than
// taken from the catalog, whose photos mostly show the back and front side by side: the glass could not be lined up
// on them. Only transforms animate, all from one clock owned by the screen, so a long list stays smooth.
import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { lerp } from '../categoryArt/motion';
import { useDesign } from '../design';

type Cutout = 'hole' | 'island' | 'notch';

/** The cut-out at the top of the screen, which the guard is shaped around. */
export function cutoutOf(model: string): Cutout {
  if (!/^iPhone/i.test(model)) return 'hole';
  return /^iPhone (X|XR|XS|11|12|13|16e)\b|^iPhone 14( Plus)?$/i.test(model) ? 'notch' : 'island';
}

// Wallpapers: the screen's two colours, then the glowing disc's.
const WALLPAPERS = [
  ['#10145c', '#2b39c9', '#f3d3b8', '#6f7bf2'],
  ['#0d3b4f', '#118aa3', '#d6f7ee', '#39c2b4'],
  ['#2a0f52', '#7a2fd0', '#f7cfe6', '#b566ea'],
  ['#0b3d24', '#16a34a', '#e4f9c8', '#5fd38a'],
  ['#4f1230', '#d0436f', '#ffe0c7', '#f58a8a'],
  ['#14233c', '#3a6ea5', '#e3eef9', '#7fb0e0'],
] as const;

function seedOf(text: string) {
  let seed = 0;
  for (let i = 0; i < text.length; i += 1) seed = (seed * 31 + text.charCodeAt(i)) % 9973;
  return seed;
}

const TURN = '17deg';
const DEPTH = 420;

export const GuardShowcase = memo(function GuardShowcase({ model, size, clock }: {
  model: string;
  /** Width of the picture. */
  size: number;
  /** 0 → 1 at a steady speed, repeating. */
  clock: SharedValue<number>;
}) {
  const d = useDesign();
  const dark = d.scheme === 'dark';
  const seed = useMemo(() => seedOf(model), [model]);
  const cutout = cutoutOf(model);
  const [from, to, orbFrom, orbTo] = WALLPAPERS[seed % WALLPAPERS.length]!;
  const phase = (seed % 12) / 12;

  const height = Math.round(size * 0.98);
  const phoneHeight = Math.round(height * 0.86);
  const phoneWidth = Math.round(phoneHeight * 0.49);
  const radius = Math.round(phoneWidth * 0.14);
  const gap = Math.round(phoneWidth * 0.52);
  const left = Math.round((size - phoneWidth - gap) / 2);
  const top = Math.round((height - phoneHeight) / 2);
  const reach = size * 0.03;

  const glass = useAnimatedStyle(() => {
    const drift = Math.sin((clock.value + phase) * Math.PI * 2);
    return {
      transform: [
        { perspective: DEPTH },
        { translateX: drift * reach },
        { translateY: -drift * reach * 0.3 },
        { rotateY: TURN },
        { scale: 1.05 + drift * 0.018 },
      ],
    };
  });
  const glint = useAnimatedStyle(() => {
    const t = (clock.value + phase) % 1;
    return { transform: [{ translateX: lerp(-phoneWidth * 1.3, phoneWidth * 1.3, t) }, { rotate: '18deg' }] };
  });

  const edge = dark ? 'rgba(255,255,255,0.9)' : '#101412';
  const mark = { width: phoneWidth, height: phoneHeight, borderRadius: radius };
  const hole = Math.max(5, Math.round(phoneWidth * 0.08));
  const cut = cutout === 'hole'
    ? { width: hole, height: hole, borderRadius: hole / 2 }
    : cutout === 'island'
      ? { width: phoneWidth * 0.3, height: hole * 1.25, borderRadius: hole }
      : { width: phoneWidth * 0.42, height: hole * 1.4, borderBottomLeftRadius: hole, borderBottomRightRadius: hole };
  const cutTop = cutout === 'notch' ? 0 : Math.round(phoneHeight * 0.03);

  return (
    <View style={{ width: size, height }} accessible={false} importantForAccessibility="no-hide-descendants">
      {/* the phone */}
      <View renderToHardwareTextureAndroid style={[mark, {
        position: 'absolute', left, top, overflow: 'hidden', backgroundColor: '#0a0c0b',
        borderWidth: 2.5, borderLeftWidth: 4, borderColor: dark ? '#3c4340' : '#1c201e',
        transform: [{ perspective: DEPTH }, { rotateY: TURN }],
      }]}>
        <View style={{ flex: 1, backgroundImage: `linear-gradient(160deg, ${from} 0%, ${to} 100%)`, alignItems: 'center' }}>
          <View style={{
            position: 'absolute', top: phoneHeight * 0.2, left: -phoneWidth * 0.25,
            width: phoneWidth * 1.1, height: phoneWidth * 1.1, borderRadius: phoneWidth,
            backgroundImage: `linear-gradient(120deg, ${orbFrom} 0%, ${orbTo} 100%)`,
          }} />
          <View style={[cut, { position: 'absolute', top: cutTop, backgroundColor: '#050606' }]} />
        </View>
      </View>

      {/* the guard, in front of it */}
      <Animated.View style={[mark, glass, {
        position: 'absolute', left: left + gap, top, overflow: 'hidden', alignItems: 'center',
        backgroundColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.42)',
        borderWidth: 1.5, borderColor: edge,
      }]}>
        <Animated.View style={[glint, {
          position: 'absolute', top: -phoneHeight * 0.2, width: phoneWidth * 0.3, height: phoneHeight * 1.4,
          backgroundColor: 'rgba(255,255,255,0.28)',
        }]} />
        <View style={[cut, {
          position: 'absolute', top: cutout === 'notch' ? -1 : cutTop, borderWidth: 1.2, borderColor: edge,
          backgroundColor: 'transparent',
        }]} />
      </Animated.View>
    </View>
  );
});
