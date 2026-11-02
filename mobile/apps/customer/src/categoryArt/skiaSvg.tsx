// The SVG elements the category drawings use (react-native-svg's names and props), drawn with Skia on the GPU.
//
// Why: with React Native's new architecture, every frame of an animated react-native-svg prop is a full UI commit;
// a dozen animated drawings meant ~40 commits per frame and a stuttering home screen. Skia reads the animated values
// on the UI thread inside its own render loop, so all the drawings can animate at once, even while scrolling.
//
// Supported (what graphics.tsx uses): Svg (viewBox, preserveAspectRatio meet/slice), G (transform, clipPath,
// opacity), Rect, Circle, Path, Line, Polygon, Image, Text, Defs with LinearGradient / RadialGradient (+ Stop,
// object-bounding-box units) and ClipPath (one Rect). Paint: fill, stroke, fillOpacity, strokeOpacity, opacity,
// strokeWidth, strokeLinecap, strokeLinejoin, strokeDasharray, strokeDashoffset. Animated*: an `animatedProps`
// shared value whose object may set matrix (G), d (Path), r / opacity (Circle), width / y (Rect), y1 / y2 (Line),
// strokeDashoffset (Path).
//
// The useDerivedValue callbacks below run on the UI thread (worklets): they may only use the animated value and plain
// numbers, strings and objects worked out beforehand, never this file's helpers (calling one there stops the app).
import { Children, createContext, isValidElement, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import {
  Canvas,
  Circle as SkCircle,
  DashPathEffect,
  Group,
  Image as SkImage,
  Line as SkLine,
  LinearGradient as SkLinearGradient,
  Paint,
  Path as SkPath,
  RadialGradient as SkRadialGradient,
  Rect as SkRect,
  RoundedRect as SkRoundedRect,
  Skia,
  Text as SkText,
  matchFont,
  rect,
  rrect,
  useImage,
  vec,
  type DataSourceParam,
  type Transforms3d,
} from '@shopify/react-native-skia';
import { ArtActivity, MotionActivity } from './motion';

type Num = number | string | undefined;
type Value<T> = T | SharedValue<T>;
type Box = { x: number; y: number; width: number; height: number };

const num = (v: Num, fallback = 0) => (v === undefined ? fallback : typeof v === 'number' ? v : parseFloat(v));
/** "50%" → 0.5, "0.5" → 0.5 (object-bounding-box units). */
const fraction = (v: Num, fallback: number) =>
  v === undefined ? fallback : typeof v === 'string' && v.trim().endsWith('%') ? parseFloat(v) / 100 : num(v);

/** A colour with an extra alpha (hex #rgb / #rrggbb, or anything Skia parses when alpha is 1). */
function withAlpha(color: string, alpha: number) {
  if (alpha >= 1) return color;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!hex) return color;
  let h = hex[1]!;
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ---- Definitions (gradients and clip paths, referenced as url(#id)) ----

type Stop = { offset: number; color: string };
type GradientDef =
  | { kind: 'linear'; x1: number; y1: number; x2: number; y2: number; stops: Stop[] }
  | { kind: 'radial'; cx: number; cy: number; r: number; stops: Stop[] };
type ClipDef = { kind: 'clip'; box: Box; rx: number };
type Def = GradientDef | ClipDef;

const Defs_ = createContext<Map<string, Def>>(new Map());

export function Defs(_: { children?: ReactNode }) {
  return null; // collected by Svg before drawing
}
export function LinearGradient(_: { id: string; x1?: Num; y1?: Num; x2?: Num; y2?: Num; children?: ReactNode }) {
  return null;
}
export function RadialGradient(_: { id: string; cx?: Num; cy?: Num; r?: Num; children?: ReactNode }) {
  return null;
}
export function Stop(_: { offset?: Num; stopColor?: string; stopOpacity?: Num }) {
  return null;
}
export function ClipPath(_: { id: string; children?: ReactNode }) {
  return null;
}

type AnyProps = Record<string, unknown> & { children?: ReactNode };

function stopsOf(children: ReactNode): Stop[] {
  const stops: Stop[] = [];
  Children.forEach(children, child => {
    if (!isValidElement(child)) return;
    const p = child.props as AnyProps;
    stops.push({ offset: fraction(p.offset as Num, 0), color: withAlpha(String(p.stopColor ?? '#000000'), num(p.stopOpacity as Num, 1)) });
  });
  return stops;
}

/** Finds Defs among the drawing's elements (top level, or inside plain G / fragments). */
function collectDefs(children: ReactNode, into: Map<string, Def>) {
  Children.forEach(children, child => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<AnyProps>;
    if (el.type === Defs) {
      Children.forEach(el.props.children, d => {
        if (!isValidElement(d)) return;
        const p = d.props as AnyProps;
        const id = String(p.id);
        if (d.type === LinearGradient) {
          into.set(id, { kind: 'linear', x1: fraction(p.x1 as Num, 0), y1: fraction(p.y1 as Num, 0), x2: fraction(p.x2 as Num, 1), y2: fraction(p.y2 as Num, 0), stops: stopsOf(p.children) });
        } else if (d.type === RadialGradient) {
          into.set(id, { kind: 'radial', cx: fraction(p.cx as Num, 0.5), cy: fraction(p.cy as Num, 0.5), r: fraction(p.r as Num, 0.5), stops: stopsOf(p.children) });
        } else if (d.type === ClipPath) {
          const shape = Children.toArray(p.children).find(isValidElement) as ReactElement<AnyProps> | undefined;
          if (shape) {
            const s = shape.props;
            into.set(id, { kind: 'clip', box: { x: num(s.x as Num), y: num(s.y as Num), width: num(s.width as Num), height: num(s.height as Num) }, rx: num(s.rx as Num) });
          }
        }
      });
    } else if (el.type === G || typeof el.type === 'symbol') {
      collectDefs(el.props.children, into);
    }
  });
}

const urlId = (v: unknown) => (typeof v === 'string' ? /^url\(#(.+)\)$/.exec(v)?.[1] : undefined);

function shader(def: GradientDef, box: Box) {
  const colors = def.stops.map(s => s.color);
  const positions = def.stops.map(s => s.offset);
  if (def.kind === 'linear') {
    return (
      <SkLinearGradient
        start={vec(box.x + def.x1 * box.width, box.y + def.y1 * box.height)}
        end={vec(box.x + def.x2 * box.width, box.y + def.y2 * box.height)}
        colors={colors}
        positions={positions}
      />
    );
  }
  return (
    <SkRadialGradient
      c={vec(box.x + def.cx * box.width, box.y + def.cy * box.height)}
      r={Math.max(0.001, def.r * ((box.width + box.height) / 2))}
      colors={colors}
      positions={positions}
    />
  );
}

// ---- Paint ----

type PaintAttrs = {
  fill?: string;
  stroke?: string;
  fillOpacity?: Num;
  strokeOpacity?: Num;
  opacity?: Num;
  strokeWidth?: Num;
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
  strokeDasharray?: number[] | string;
  strokeDashoffset?: Value<number>;
};

/** The fill and stroke paints for one shape, as Skia Paint children (a shape with both is drawn twice). */
function usePaints(p: PaintAttrs, box: Box): ReactNode[] {
  const defs = useContext(Defs_);
  const out: ReactNode[] = [];
  const opacity = num(p.opacity, 1);
  const paintFor = (color: string | undefined, alpha: number) => {
    const id = urlId(color);
    const def = id ? defs.get(id) : undefined;
    if (def && def.kind !== 'clip') return { color: 'white', alpha, child: shader(def, box) };
    return { color: color ?? '#000000', alpha, child: null };
  };
  if (p.fill && p.fill !== 'none') {
    const f = paintFor(p.fill, opacity * num(p.fillOpacity, 1));
    out.push(<Paint key="fill" color={f.color} opacity={f.alpha}>{f.child}</Paint>);
  }
  if (p.stroke && p.stroke !== 'none') {
    const s = paintFor(p.stroke, opacity * num(p.strokeOpacity, 1));
    const dashes = typeof p.strokeDasharray === 'string' ? p.strokeDasharray.split(/[\s,]+/).map(Number) : p.strokeDasharray;
    out.push(
      <Paint key="stroke" style="stroke" color={s.color} opacity={s.alpha} strokeWidth={num(p.strokeWidth, 1)}
        strokeCap={p.strokeLinecap ?? 'butt'} strokeJoin={p.strokeLinejoin ?? 'miter'}>
        {s.child}
        {dashes?.length ? <DashPathEffect intervals={dashes} phase={p.strokeDashoffset ?? 0} /> : null}
      </Paint>,
    );
  }
  return out;
}

// ---- Transforms ----

/** "translate(10, 20) rotate(-12) scale(-1, 1)" → Skia transforms (applied in the same order as SVG). */
function parseTransform(t: string | undefined): Transforms3d | undefined {
  if (!t) return undefined;
  const out: Transforms3d = [];
  for (const [, name, args] of t.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const a = args!.split(/[\s,]+/).filter(Boolean).map(Number);
    if (name === 'translate') out.push({ translateX: a[0] ?? 0 }, { translateY: a[1] ?? 0 });
    else if (name === 'rotate') {
      if (a.length === 3) out.push({ translateX: a[1]! }, { translateY: a[2]! }, { rotate: (a[0]! * Math.PI) / 180 }, { translateX: -a[1]! }, { translateY: -a[2]! });
      else out.push({ rotate: (a[0]! * Math.PI) / 180 });
    } else if (name === 'scale') out.push({ scaleX: a[0] ?? 1 }, { scaleY: a[1] ?? a[0] ?? 1 });
  }
  return out;
}

/** SVG matrix(a b c d e f) → Skia's 3 × 3 row-major matrix. */
export function svgMatrix(m: number[]): number[] {
  'worklet';
  return [m[0]!, m[2]!, m[4]!, m[1]!, m[3]!, m[5]!, 0, 0, 1];
}

// ---- Root ----

export default function Svg({ width, height, viewBox, preserveAspectRatio, children }: {
  width: number;
  height: number;
  viewBox: string;
  preserveAspectRatio?: string;
  fill?: string;
  children?: ReactNode;
}) {
  const defs = useMemo(() => {
    const map = new Map<string, Def>();
    collectDefs(children, map);
    return map;
  }, [children]);
  // Contexts are passed into the Canvas by hand: it renders with its own reconciler.
  const art = useContext(ArtActivity);
  const motion = useContext(MotionActivity);
  const [vx, vy, vw, vh] = viewBox.split(/[\s,]+/).map(Number) as [number, number, number, number];
  const slice = preserveAspectRatio?.includes('slice');
  const s = slice ? Math.max(width / vw, height / vh) : Math.min(width / vw, height / vh);
  const transform: Transforms3d = [
    { translateX: (width - vw * s) / 2 - vx * s },
    { translateY: (height - vh * s) / 2 - vy * s },
    { scale: s },
  ];
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <ArtActivity.Provider value={art}>
        <MotionActivity.Provider value={motion}>
          <Defs_.Provider value={defs}>
            <Group clip={rect(0, 0, width, height)}>
              <Group transform={transform}>{children}</Group>
            </Group>
          </Defs_.Provider>
        </MotionActivity.Provider>
      </ArtActivity.Provider>
    </Canvas>
  );
}

// ---- Group ----

type GProps = { transform?: string; clipPath?: string; opacity?: Num; children?: ReactNode };

export function G({ transform, clipPath, opacity, children }: GProps) {
  const defs = useContext(Defs_);
  const clipId = urlId(clipPath);
  const clip = clipId ? defs.get(clipId) : undefined;
  const clipShape = clip?.kind === 'clip' ? rrect(rect(clip.box.x, clip.box.y, clip.box.width, clip.box.height), clip.rx, clip.rx) : undefined;
  return (
    <Group transform={parseTransform(transform)} clip={clipShape} opacity={opacity === undefined ? undefined : num(opacity)}>
      {children}
    </Group>
  );
}

// Any shared or derived value (only its current value is read, on the UI thread).
type Animated<T> = { animatedProps?: { readonly value: T } };

/** A G whose `matrix` (SVG order a b c d e f) and/or `opacity` come from a shared value. */
export function AnimatedG({ animatedProps, transform, children }: GProps & Animated<{ matrix?: number[]; opacity?: number }>) {
  const matrix = useDerivedValue(() => svgMatrix(animatedProps?.value.matrix ?? [1, 0, 0, 1, 0, 0]));
  const opacity = useDerivedValue(() => animatedProps?.value.opacity ?? 1);
  return (
    <Group matrix={matrix} opacity={opacity}>
      <G transform={transform}>{children}</G>
    </Group>
  );
}

// ---- Shapes ----

type RectProps = PaintAttrs & { x?: Num; y?: Num; width?: Num; height?: Num; rx?: Num; ry?: Num };

export function Rect(p: RectProps) {
  const box = { x: num(p.x), y: num(p.y), width: num(p.width), height: num(p.height) };
  const paints = usePaints(p, box);
  const r = num(p.rx ?? p.ry);
  return r > 0
    ? <SkRoundedRect x={box.x} y={box.y} width={box.width} height={box.height} r={r}>{paints}</SkRoundedRect>
    : <SkRect x={box.x} y={box.y} width={box.width} height={box.height}>{paints}</SkRect>;
}

export function AnimatedRect({ animatedProps, ...p }: RectProps & Animated<{ width?: number; y?: number }>) {
  const box = { x: num(p.x), y: num(p.y), width: num(p.width), height: num(p.height) };
  const paints = usePaints(p, box);
  const width = useDerivedValue(() => animatedProps?.value.width ?? box.width);
  const y = useDerivedValue(() => animatedProps?.value.y ?? box.y);
  const r = num(p.rx ?? p.ry);
  return <SkRoundedRect x={box.x} y={y} width={width} height={box.height} r={r}>{paints}</SkRoundedRect>;
}

type CircleProps = PaintAttrs & { cx?: Num; cy?: Num; r?: Num };

export function Circle(p: CircleProps) {
  const r = num(p.r);
  const box = { x: num(p.cx) - r, y: num(p.cy) - r, width: r * 2, height: r * 2 };
  const paints = usePaints(p, box);
  return <SkCircle cx={num(p.cx)} cy={num(p.cy)} r={r}>{paints}</SkCircle>;
}

export function AnimatedCircle({ animatedProps, ...p }: CircleProps & Animated<{ r?: number; opacity?: number }>) {
  const r0 = num(p.r);
  const box = { x: num(p.cx) - r0, y: num(p.cy) - r0, width: r0 * 2, height: r0 * 2 };
  const paints = usePaints(p, box);
  const r = useDerivedValue(() => animatedProps?.value.r ?? r0);
  const opacity = useDerivedValue(() => animatedProps?.value.opacity ?? 1);
  return (
    <Group opacity={opacity}>
      <SkCircle cx={num(p.cx)} cy={num(p.cy)} r={r}>{paints}</SkCircle>
    </Group>
  );
}

const boundsCache = new Map<string, Box>();
function pathBox(d: string): Box {
  let box = boundsCache.get(d);
  if (!box) {
    const b = Skia.Path.MakeFromSVGString(d)?.computeTightBounds();
    box = b ? { x: b.x, y: b.y, width: b.width, height: b.height } : { x: 0, y: 0, width: 1, height: 1 };
    boundsCache.set(d, box);
  }
  return box;
}

type PathProps = PaintAttrs & { d: string };

export function Path(p: PathProps) {
  const paints = usePaints(p, pathBox(p.d));
  return <SkPath path={p.d}>{paints}</SkPath>;
}

export function AnimatedPath({ animatedProps, ...p }: PathProps & Animated<{ d?: string; strokeDashoffset?: number }>) {
  const dash0 = num(p.strokeDashoffset as Num);
  const d0 = p.d;
  const dashOffset = useDerivedValue(() => animatedProps?.value.strokeDashoffset ?? dash0);
  const paints = usePaints({ ...p, strokeDashoffset: dashOffset }, pathBox(p.d));
  const path = useDerivedValue(() => {
    'worklet';
    return Skia.Path.MakeFromSVGString(animatedProps?.value.d ?? d0) ?? Skia.Path.Make();
  });
  return <SkPath path={path}>{paints}</SkPath>;
}

export function Polygon({ points, ...p }: PaintAttrs & { points: string }) {
  const nums = points.trim().split(/[\s,]+/).map(Number);
  let d = '';
  for (let i = 0; i < nums.length; i += 2) d += `${i ? 'L' : 'M'} ${nums[i]} ${nums[i + 1]} `;
  return <Path {...p} d={`${d}Z`} />;
}

type LineProps = PaintAttrs & { x1?: Num; y1?: Num; x2?: Num; y2?: Num };

export function Line(p: LineProps) {
  const paints = usePaints(p, { x: 0, y: 0, width: 1, height: 1 });
  return <SkLine p1={vec(num(p.x1), num(p.y1))} p2={vec(num(p.x2), num(p.y2))}>{paints}</SkLine>;
}

export function AnimatedLine({ animatedProps, ...p }: LineProps & Animated<{ y1?: number; y2?: number }>) {
  const paints = usePaints(p, { x: 0, y: 0, width: 1, height: 1 });
  const x1 = num(p.x1);
  const x2 = num(p.x2);
  const y1 = num(p.y1);
  const y2 = num(p.y2);
  const p1 = useDerivedValue(() => ({ x: x1, y: animatedProps?.value.y1 ?? y1 }));
  const p2 = useDerivedValue(() => ({ x: x2, y: animatedProps?.value.y2 ?? y2 }));
  return <SkLine p1={p1} p2={p2}>{paints}</SkLine>;
}

// ---- Image and text ----

export function Image({ x, y, width, height, href }: { x: number; y: number; width: number; height: number; href: DataSourceParam; preserveAspectRatio?: string }) {
  const image = useImage(href);
  if (!image) return null;
  return <SkImage image={image} x={x} y={y} width={width} height={height} fit="contain" />;
}

type FontWeight = 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
const fontCache = new Map<string, ReturnType<typeof matchFont>>();
function fontFor(size: number, weight: FontWeight, mono: boolean) {
  const key = `${size}|${weight}|${mono}`;
  let font = fontCache.get(key);
  if (!font) {
    const family = mono ? 'monospace' : Platform.select({ ios: 'Helvetica', default: 'sans-serif' });
    try {
      font = matchFont({ fontFamily: family, fontSize: size, fontWeight: weight, fontStyle: 'normal' });
    } catch {
      // No system font lookup (the web build): Skia's default font, which may draw nothing there.
      font = Skia.Font(undefined, size);
    }
    fontCache.set(key, font);
  }
  return font;
}

export function Text({ x, y, textAnchor, fontSize, fontWeight = 'normal', fontFamily, fill = '#000000', opacity, children }: {
  x?: Num;
  y?: Num;
  textAnchor?: 'start' | 'middle' | 'end';
  fontSize?: Num;
  fontWeight?: string;
  fontFamily?: string;
  letterSpacing?: Num;
  fill?: string;
  opacity?: Num;
  children?: ReactNode;
}) {
  const text = Children.toArray(children).join('');
  const font = fontFor(num(fontSize, 10), String(fontWeight) as FontWeight, fontFamily === 'monospace');
  let width = 0;
  try {
    width = font.getTextWidth(text);
  } catch {
    // measured as 0 where the font has no glyphs
  }
  const left = num(x) - (textAnchor === 'middle' ? width / 2 : textAnchor === 'end' ? width : 0);
  return <SkText x={left} y={num(y)} text={text} font={font} color={fill} opacity={num(opacity, 1)} />;
}
