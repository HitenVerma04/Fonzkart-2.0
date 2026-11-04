// The home screen's background: a faint line drawing of a Fonzkart factory, behind everything. Devices arrive, are
// tested, repaired, packed and sent out, one station under the other. Scrolling the page travels through it, slower than
// the content, reaching the last station at the end of the page; scrolling back returns to the first.
//
// Kept light on purpose: the stations are still drawings, the only moving parts are a few small views (transforms and
// opacity), a station's parts run only while it is on screen, and scrolling moves the whole layer as one view on the UI
// thread.
import { memo, useContext, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useColors } from '@fonzkart/ui';
import { ArtActivity, useSpin } from '../categoryArt/motion';

const WIDTH = 390; // the drawings' design size
const STATION = 320;
const STATIONS = 5;
const TOP = 170; // the first station starts just under the header
const BOTTOM = 120; // the last station stops clear of the tab bar
const INK = 0.17; // how strongly the lines show
const CYCLE = 14; // seconds for the clock to go round: every moving part repeats within it

type Part = { clock: SharedValue<number>; ink: string; k: number };

/** The outline of a gear, centred on (r, r). */
function gearPath(r: number, teeth: number) {
  const points: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i += 1) {
    const a = i * step;
    [[a - step * 0.28, 0.8], [a - step * 0.14, 1], [a + step * 0.14, 1], [a + step * 0.28, 0.8]].forEach(([t, s]) => {
      points.push(`${(r + Math.cos(t!) * r * s!).toFixed(1)} ${(r + Math.sin(t!) * r * s!).toFixed(1)}`);
    });
  }
  return `M${points.join('L')}Z`;
}

export const FactoryBackground = memo(function FactoryBackground({ scrollY, contentHeight }: { scrollY: SharedValue<number>; contentHeight: SharedValue<number> }) {
  const colors = useColors();
  const { width, height: viewport } = useWindowDimensions();
  const clock = useSpin(CYCLE);
  const scene = Math.min(width, 640);
  const k = scene / WIDTH;
  const station = STATION * k;
  const total = TOP + station * STATIONS + BOTTOM;

  // The page's whole scroll range maps onto the whole factory.
  const shift = useDerivedValue(() => {
    const range = Math.max(1, contentHeight.value - viewport);
    const y = Math.min(Math.max(scrollY.value, 0), range);
    return (-y / range) * Math.max(0, total - viewport);
  });
  const travel = useAnimatedStyle(() => ({ transform: [{ translateY: shift.value }] }));

  const ink = `${colors.green}2b`;
  const place = { size: scene, left: (width - scene) / 2, color: colors.green, ink, shift, viewport };

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.scene, { height: total }, travel]}>
        <Pipe left={6} height={total} clock={clock} ink={ink} />
        <Pipe left={width - 10} height={total} reverse clock={clock} ink={ink} />

        {/* Collection: devices come down the chute onto the belt */}
        <Station {...place} index={0} d={`${BELT} M40 118h72l-18 62h-36z M60 180v38 M240 70h136v132H240z`}>
          {part => (
            <>
              <Gear part={part} x={252} y={84} r={44} teeth={12} turns={1} color={colors.green} />
              <Gear part={part} x={326} y={140} r={22} teeth={6} turns={-2} color={colors.green} />
              <Riders part={part} shape="phone" count={3} />
            </>
          )}
        </Station>

        {/* Testing: a scanner reads each device, an arm sorts it */}
        <Station {...place} index={1} d={`${BELT} M126 232V96h132v136 M116 96h152 M176 96v22h32V96 M316 232h48v-14h-48z`}>
          {part => (
            <>
              <Beam part={part} />
              <Arm part={part} x={340} y={218} color={colors.green} />
              <Riders part={part} shape="phone" count={3} offset={0.15} />
            </>
          )}
        </Station>

        {/* Repair: the workshop's big gears */}
        <Station {...place} index={2} d="M24 290H366 M22 52h118v62h54 M368 40v92h-84 M210 40h40v32h-40z">
          {part => (
            <>
              <Gear part={part} x={78} y={132} r={72} teeth={16} turns={1} color={colors.green} />
              <Gear part={part} x={208} y={150} r={45} teeth={10} turns={-1.6} color={colors.green} />
              <Arm part={part} x={346} y={288} color={colors.green} slow />
            </>
          )}
        </Station>

        {/* Packing: a press closes each box */}
        <Station {...place} index={3} d={`${BELT} M152 232V78h82v154 M142 78h102 M306 218v-46h60v46z M318 172v-38h40v38z`}>
          {part => (
            <>
              <Press part={part} />
              <Riders part={part} shape="box" count={3} offset={0.3} />
            </>
          )}
        </Station>

        {/* Dispatch: out to the customer */}
        <Station {...place} index={4} d="M24 130l50-38v38l50-38v38l50-38v38h60V54h26v76h156 M24 292H366 M60 272v-66h122v66 M182 228h52l26 24v20h-78">
          {part => (
            <>
              <Smoke part={part} x={250} y={46} />
              <Wheel part={part} x={84} y={260} color={colors.green} />
              <Wheel part={part} x={206} y={260} color={colors.green} />
            </>
          )}
        </Station>
      </Animated.View>
    </View>
  );
});

function Station({ index, d, size, left, color, ink, shift, viewport, children }: {
  index: number;
  d: string;
  size: number;
  left: number;
  color: string;
  ink: string;
  shift: SharedValue<number>;
  viewport: number;
  children: (part: Part) => ReactNode;
}) {
  const k = size / WIDTH;
  const height = k * STATION;
  const top = TOP + index * height;
  const factory = useContext(ArtActivity);
  const active = useSharedValue(true);
  useAnimatedReaction(() => factory.value && top + shift.value < viewport && top + height + shift.value > 0, (on, previous) => {
    if (on !== previous) active.value = on;
  });
  return (
    <View style={{ position: 'absolute', top, left, width: size, height }}>
      <Svg width={size} height={height} viewBox={`0 0 ${WIDTH} ${STATION}`}>
        <Path d={d} stroke={color} strokeOpacity={INK} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
      <ArtActivity.Provider value={active}>
        <MovingParts ink={ink} k={k}>{children}</MovingParts>
      </ArtActivity.Provider>
    </View>
  );
}

/** A station's moving parts, on a clock that stops when the station is off screen. */
function MovingParts({ ink, k, children }: { ink: string; k: number; children: (part: Part) => ReactNode }) {
  const clock = useSpin(CYCLE);
  return <>{children({ clock, ink, k })}</>;
}

const BELT = 'M24 232H366 M24 244H366 M60 244v48 M330 244v48 M44 292h32 M314 292h32';

function Gear({ part, x, y, r, teeth, turns, color }: { part: Part; x: number; y: number; r: number; teeth: number; turns: number; color: string }) {
  const { clock, k } = part;
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${clock.value * 360 * turns}deg` }] }));
  const size = r * 2 * k;
  return (
    <Animated.View style={[styles.place, { left: x * k, top: y * k, width: size, height: size }, spin]}>
      <Svg width={size} height={size} viewBox={`-1 -1 ${r * 2 + 2} ${r * 2 + 2}`}>
        <Path d={gearPath(r, teeth)} stroke={color} strokeOpacity={INK} strokeWidth={1.5} fill="none" />
        <Circle cx={r} cy={r} r={r * 0.28} stroke={color} strokeOpacity={INK} strokeWidth={1.5} fill="none" />
      </Svg>
    </Animated.View>
  );
}

/** Devices or boxes riding along a station's belt, appearing at one end and fading at the other. */
function Riders({ part, shape, count, offset = 0 }: { part: Part; shape: 'phone' | 'box'; count: number; offset?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => <Rider key={i} part={part} shape={shape} phase={offset + i / count} />)}
    </>
  );
}

function Rider({ part, shape, phase }: { part: Part; shape: 'phone' | 'box'; phase: number }) {
  const { clock, ink, k } = part;
  const w = (shape === 'phone' ? 15 : 26) * k;
  const h = (shape === 'phone' ? 28 : 22) * k;
  const ride = useAnimatedStyle(() => {
    const t = (clock.value * 2 + phase) % 1;
    return { opacity: Math.min(1, Math.sin(t * Math.PI) * 4), transform: [{ translateX: (30 + t * 310) * k }] };
  });
  return <Animated.View style={[styles.rider, { top: 232 * k - h, width: w, height: h, borderRadius: shape === 'phone' ? 3 : 2, borderColor: ink }, ride]} />;
}

function Beam({ part }: { part: Part }) {
  const { clock, ink, k } = part;
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: Math.sin(clock.value * Math.PI * 8) * 48 * k }] }));
  return <Animated.View style={[styles.place, { left: 192 * k, top: 118 * k, width: 1.5, height: 110 * k, backgroundColor: ink }, sweep]} />;
}

function Arm({ part, x, y, color, slow }: { part: Part; x: number; y: number; color: string; slow?: boolean }) {
  const { clock, k } = part;
  const swing = useAnimatedStyle(() => ({ transform: [{ rotate: `${Math.sin(clock.value * Math.PI * (slow ? 4 : 6)) * 16 - 8}deg` }] }));
  const w = 84 * k;
  const h = 112 * k;
  return (
    <Animated.View style={[styles.place, styles.arm, { left: x * k - w / 2, top: y * k - h, width: w, height: h }, swing]}>
      <Svg width={w} height={h} viewBox="0 0 84 112">
        <Path d="M42 112 42 58 16 26M16 26l-10 8M16 26l6-12" stroke={color} strokeOpacity={INK} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Circle cx={42} cy={58} r={5} stroke={color} strokeOpacity={INK} strokeWidth={1.5} fill="none" />
      </Svg>
    </Animated.View>
  );
}

function Press({ part }: { part: Part }) {
  const { clock, ink, k } = part;
  const stamp = useAnimatedStyle(() => ({ transform: [{ translateY: (Math.sin(clock.value * Math.PI * 12) + 1) * 26 * k }] }));
  return (
    <Animated.View style={[styles.place, { left: 176 * k, top: 86 * k, width: 34 * k, alignItems: 'center' }, stamp]}>
      <View style={{ width: 1.5, height: 56 * k, backgroundColor: ink }} />
      <View style={{ width: 34 * k, height: 10 * k, borderRadius: 2, borderWidth: 1.5, borderColor: ink }} />
    </Animated.View>
  );
}

function Wheel({ part, x, y, color }: { part: Part; x: number; y: number; color: string }) {
  const { clock, k } = part;
  const roll = useAnimatedStyle(() => ({ transform: [{ rotate: `${clock.value * 360 * 3}deg` }] }));
  const size = 24 * k;
  return (
    <Animated.View style={[styles.place, { left: x * k, top: y * k, width: size, height: size }, roll]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={11} stroke={color} strokeOpacity={INK} strokeWidth={1.5} fill="none" />
        <Path d="M12 3v18M3 12h18" stroke={color} strokeOpacity={INK} strokeWidth={1.2} />
      </Svg>
    </Animated.View>
  );
}

function Smoke({ part, x, y }: { part: Part; x: number; y: number }) {
  return (
    <>
      {[0, 1 / 3, 2 / 3].map(phase => <Puff key={phase} part={part} x={x} y={y} phase={phase} />)}
    </>
  );
}

function Puff({ part, x, y, phase }: { part: Part; x: number; y: number; phase: number }) {
  const { clock, ink, k } = part;
  const rise = useAnimatedStyle(() => {
    const t = (clock.value * 3 + phase) % 1;
    return { opacity: Math.sin(t * Math.PI), transform: [{ translateY: -t * 44 * k }, { translateX: t * 16 * k }, { scale: 0.6 + t * 0.9 }] };
  });
  return <Animated.View style={[styles.place, { left: x * k, top: y * k, width: 14 * k, height: 14 * k, borderRadius: 7 * k, borderWidth: 1.5, borderColor: ink }, rise]} />;
}

/** A pipe down the side of the page, in the screen's margin, with packets flowing along it. */
function Pipe({ left, height, reverse, clock, ink }: { left: number; height: number; reverse?: boolean; clock: SharedValue<number>; ink: string }) {
  const gap = 120;
  const flow = useAnimatedStyle(() => ({ transform: [{ translateY: ((clock.value * 7) % 1) * gap * (reverse ? -1 : 1) }] }));
  const dots = Math.ceil(height / gap) + 2;
  return (
    <>
      <View style={[styles.place, { left: left + 1.5, top: 0, width: 1, height, backgroundColor: ink }]} />
      <Animated.View style={[styles.place, { left, top: -gap }, flow]}>
        {Array.from({ length: dots }, (_, i) => <View key={i} style={{ width: 4, height: 8, marginBottom: gap - 8, borderRadius: 2, backgroundColor: ink }} />)}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  scene: { position: 'absolute', top: 0, left: 0, right: 0 },
  place: { position: 'absolute' },
  arm: { transformOrigin: 'bottom' },
  rider: { position: 'absolute', left: 0, borderWidth: 1.5 },
});
