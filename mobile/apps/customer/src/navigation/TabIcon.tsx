// Line icons for the bottom tabs (24 × 24), drawn with react-native-svg so no icon font is needed.
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TabIconName = 'buy' | 'sell' | 'repair' | 'orders' | 'profile' | 'shield';

export function TabIcon({ name, color, size = 24, focused }: { name: TabIconName; color: string; size?: number; focused: boolean }) {
  const stroke = { stroke: color, strokeWidth: focused ? 2.2 : 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'buy' ? (
        <>
          <Path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8z" {...stroke} />
          <Path d="M9 10V7a3 3 0 0 1 6 0v3" {...stroke} />
        </>
      ) : null}
      {name === 'sell' ? (
        <>
          <Path d="M3 12.6V4a1 1 0 0 1 1-1h8.6a1 1 0 0 1 .7.3l7.4 7.4a1 1 0 0 1 0 1.4l-8.6 8.6a1 1 0 0 1-1.4 0l-7.4-7.4a1 1 0 0 1-.3-.7z" {...stroke} />
          <Circle cx="7.5" cy="7.5" r="1.5" fill={color} />
        </>
      ) : null}
      {name === 'repair' ? (
        <Path
          d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"
          {...stroke}
        />
      ) : null}
      {name === 'shield' ? (
        <>
          <Path d="M12 3 4 6v6c0 4.6 3.4 8.3 8 9 4.6-.7 8-4.4 8-9V6l-8-3z" {...stroke} />
          <Path d="m8.5 12 2.5 2.5 4.5-5" {...stroke} />
        </>
      ) : null}
      {name === 'orders' ? (
        // The Fonzkart cart (mobile/brand/fonzkart_cart_icon.png) in outline: handle, slanted basket, two wheels and
        // the green "F" phone standing in it.
        <>
          <Path d="M1.5 3.5h2.6l2.2 11.6a2 2 0 0 0 2 1.6h10.2a1.5 1.5 0 0 0 1.4-1l2.1-6.2" {...stroke} />
          <Rect x="10.4" y="3.2" width="5.2" height="9.6" rx="1.2" {...stroke} />
          <Path d="M12.2 9.8V6.4h2M12.2 8.1h1.5" {...stroke} strokeWidth={1.4} />
          <Circle cx="9.2" cy="20.4" r="1.6" {...stroke} />
          <Circle cx="17.6" cy="20.4" r="1.6" {...stroke} />
        </>
      ) : null}
      {name === 'profile' ? (
        <>
          <Circle cx="12" cy="8" r="3.8" {...stroke} />
          <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}
