// The five services as two-tone glyphs, drawn for the launch animation: a soft filled shape with crisp lines over it.
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type ServiceGlyphName = 'sell' | 'buy' | 'repair' | 'guard' | 'refurbish';

export function ServiceGlyph({ name, color, size }: { name: ServiceGlyphName; color: string; size: number }) {
  const line = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const body = { ...line, fill: color, fillOpacity: 0.24 };
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {name === 'sell' ? (
        <>
          <Path d="M4.500 15.800V6.500a2 2 0 0 1 2-2h9.300a2 2 0 0 1 1.400.6l9.700 9.700a2 2 0 0 1 0 2.800l-9.300 9.300a2 2 0 0 1-2.800 0l-9.700-9.700a2 2 0 0 1-.6-1.400z" {...body} />
          <Circle cx={10} cy={10} r={1.900} fill={color} />
          <Path d="M13.800 14.200h6.400M13.800 16.700h6.400M15.800 14.200c3.200 0 3.200 5 0 5h-1.800l4.700 4.300" {...line} strokeWidth={1.700} />
        </>
      ) : null}
      {name === 'buy' ? (
        <>
          <Path d="M6.800 10.500h18.400l1.500 15.300a2.200 2.200 0 0 1-2.200 2.400H7.500a2.200 2.200 0 0 1-2.200-2.400z" {...body} />
          <Path d="M11 14.500V9a5 5 0 0 1 10 0v5.500" {...line} />
          <Circle cx={11} cy={15} r={1.300} fill={color} />
          <Circle cx={21} cy={15} r={1.300} fill={color} />
        </>
      ) : null}
      {name === 'repair' ? (
        <>
          <Path d="M5 5l3.500-1 8.700 8.700-2.500 2.500L6 6.500zM16.500 17l8.700 8.700a2.300 2.300 0 0 1-3.300 3.300L13.200 20.300" {...body} />
          <Path d="M28 9.200a6.800 6.800 0 0 1-9.200 6.300L9.500 24.800a3.200 3.200 0 1 1-4.500-4.500l9.300-9.300a6.800 6.800 0 0 1 8.500-8.900l-4.300 4.300 1 3.800 3.800 1 4.300-4.300c.3.700.4 1.500.4 2.300z" {...line} />
        </>
      ) : null}
      {name === 'guard' ? (
        <>
          <Path d="M16 3.200 26.500 7v8.500c0 6.600-4.300 11.200-10.500 13.300C9.800 26.700 5.500 22.100 5.500 15.500V7z" {...body} />
          <Path d="m10.800 15.800 3.800 3.800 6.800-7.200" {...line} strokeWidth={2.600} />
        </>
      ) : null}
      {name === 'refurbish' ? (
        <>
          <Rect x={6.500} y={5} width={15} height={24} rx={3.400} {...body} />
          <Path d="M12 25.300h4" {...line} />
          <Path d="M25 1.500c.5 3.300 1.700 4.500 5 5-3.300.5-4.500 1.700-5 5-.5-3.300-1.700-4.500-5-5 3.300-.5 4.500-1.700 5-5z" fill={color} />
          <Path d="M27 16c.2 1.500.8 2 2.200 2.200-1.400.3-2 .8-2.200 2.300-.2-1.500-.8-2-2.200-2.300 1.400-.2 2-.7 2.200-2.200z" fill={color} />
        </>
      ) : null}
    </Svg>
  );
}
