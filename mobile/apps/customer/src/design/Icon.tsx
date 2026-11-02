// The app's icons (24 × 24 line icons, drawn with react-native-svg, so no icon font). `filled` gives the duotone
// look used for the active tab and highlighted actions: the shape is tinted, the outline stays crisp.
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'sell' | 'buy' | 'repair' | 'orders' | 'profile' | 'shield'
  | 'search' | 'back' | 'close' | 'bell' | 'chevronRight' | 'chevronDown' | 'location' | 'check' | 'phone' | 'chat'
  | 'mail' | 'bolt' | 'truck' | 'wallet' | 'sparkle' | 'logout' | 'trash' | 'sun' | 'moon' | 'auto' | 'clock'
  | 'cash' | 'refresh' | 'alert' | 'box' | 'user' | 'lock' | 'building'
  | 'laptop' | 'tablet' | 'watch' | 'tv' | 'gamepad' | 'camera' | 'headphones' | 'monitor' | 'recycle' | 'grid';

export function Icon({ name, color, size = 24, filled = false, strokeWidth }: {
  name: IconName;
  color: string;
  size?: number;
  filled?: boolean;
  strokeWidth?: number;
}) {
  const s = { stroke: color, strokeWidth: strokeWidth ?? (filled ? 2 : 1.8), strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  // The duotone fill: the same colour, faint.
  const f = { ...s, fill: filled ? color : 'none', fillOpacity: filled ? 0.2 : 0 };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'sell' ? (
        <>
          <Path d="M3 12.4V4.6A1.6 1.6 0 0 1 4.6 3h7.8c.4 0 .8.2 1.1.5l7 7a1.6 1.6 0 0 1 0 2.3l-7.7 7.7a1.6 1.6 0 0 1-2.3 0l-7-7A1.6 1.6 0 0 1 3 12.4z" {...f} />
          <Circle cx="7.8" cy="7.8" r="1.6" fill={color} stroke="none" />
        </>
      ) : null}
      {name === 'buy' ? (
        <>
          <Path d="M4.5 8h15l-1.1 11.3A2 2 0 0 1 16.4 21H7.6a2 2 0 0 1-2-1.7L4.5 8z" {...f} />
          <Path d="M8.8 10.5V7a3.2 3.2 0 0 1 6.4 0v3.5" {...s} />
        </>
      ) : null}
      {name === 'repair' ? (
        <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.4-3.4a6 6 0 0 1-7.9 7.9l-6.4 6.4a2.2 2.2 0 0 1-3.1-3.1l6.4-6.4a6 6 0 0 1 7.9-7.9l-3.3 3.5z" {...f} />
      ) : null}
      {name === 'orders' ? (
        // The Fonzkart cart: handle, basket, wheels, and the "F" phone standing in it.
        <>
          <Path d="M1.8 3.5h2.4l2.2 11.4a2 2 0 0 0 2 1.6h9.9a1.6 1.6 0 0 0 1.5-1.1l2-6" {...s} />
          <Rect x="10.2" y="3" width="5.6" height="10" rx="1.4" {...f} />
          <Path d="M12.2 10.2V6.6h2.1M12.2 8.4h1.6" {...s} strokeWidth={1.5} />
          <Circle cx="9.3" cy="20.2" r="1.6" {...s} />
          <Circle cx="17.4" cy="20.2" r="1.6" {...s} />
        </>
      ) : null}
      {name === 'profile' || name === 'user' ? (
        <>
          <Circle cx="12" cy="8" r="4" {...f} />
          <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" {...s} />
        </>
      ) : null}
      {name === 'shield' ? (
        <>
          <Path d="M12 3 4.5 6v5.8c0 4.6 3.2 8.2 7.5 9.2 4.3-1 7.5-4.6 7.5-9.2V6L12 3z" {...f} />
          <Path d="m8.8 12 2.3 2.3 4.2-4.6" {...s} />
        </>
      ) : null}
      {name === 'search' ? (
        <>
          <Circle cx="10.8" cy="10.8" r="6.3" {...f} />
          <Path d="m15.6 15.6 4.6 4.6" {...s} />
        </>
      ) : null}
      {name === 'back' ? <Path d="M15 5 8 12l7 7" {...s} /> : null}
      {name === 'close' ? <Path d="M6 6l12 12M18 6 6 18" {...s} /> : null}
      {name === 'chevronRight' ? <Path d="m9.5 6 6 6-6 6" {...s} /> : null}
      {name === 'chevronDown' ? <Path d="m6 9.5 6 6 6-6" {...s} /> : null}
      {name === 'bell' ? (
        <>
          <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15L6 16.5z" {...f} />
          <Path d="M10 20.5a2.2 2.2 0 0 0 4 0" {...s} />
        </>
      ) : null}
      {name === 'location' ? (
        <>
          <Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" {...f} />
          <Circle cx="12" cy="10" r="2.3" {...s} />
        </>
      ) : null}
      {name === 'check' ? <Path d="m5 12.5 4.5 4.5L19 7.5" {...s} /> : null}
      {name === 'phone' ? (
        <Path d="M6.6 3.5h2.6l1.4 4.1-2 1.4a11 11 0 0 0 6.4 6.4l1.4-2 4.1 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" {...f} />
      ) : null}
      {name === 'chat' ? (
        <>
          <Path d="M4 19.5 5.3 16A8 8 0 1 1 8 18.7L4 19.5z" {...f} />
          <Path d="M9 11h.01M12 11h.01M15 11h.01" {...s} strokeWidth={2.4} />
        </>
      ) : null}
      {name === 'mail' ? (
        <>
          <Rect x="3" y="5.5" width="18" height="13" rx="2.5" {...f} />
          <Path d="m4 7.5 8 5.5 8-5.5" {...s} />
        </>
      ) : null}
      {name === 'bolt' ? <Path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12l1-8z" {...f} /> : null}
      {name === 'truck' ? (
        <>
          <Path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3.2v2.8h-7z" {...f} />
          <Circle cx="6.5" cy="17.5" r="1.8" {...s} />
          <Circle cx="17" cy="17.5" r="1.8" {...s} />
        </>
      ) : null}
      {name === 'wallet' ? (
        <>
          <Path d="M4 6.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10a2.5 2.5 0 0 1 2.5-2.5H16" {...f} />
          <Circle cx="16" cy="13" r="1.2" fill={color} stroke="none" />
        </>
      ) : null}
      {name === 'sparkle' ? (
        <Path d="M12 3c.6 4.2 2.2 6.4 6.5 7-4.3.8-5.9 2.8-6.5 7-.6-4.2-2.2-6.2-6.5-7 4.3-.6 5.9-2.8 6.5-7zM18.5 15.5c.3 1.7.9 2.5 2.5 2.8-1.6.3-2.2 1.1-2.5 2.7-.3-1.6-.9-2.4-2.5-2.7 1.6-.3 2.2-1.1 2.5-2.8z" {...f} />
      ) : null}
      {name === 'logout' ? (
        <>
          <Path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14" {...s} />
          <Path d="M10 12h10m-3.5-3.5L20 12l-3.5 3.5" {...s} />
        </>
      ) : null}
      {name === 'trash' ? (
        <>
          <Path d="M5.5 7h13l-1 12.2a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8L5.5 7z" {...f} />
          <Path d="M4 7h16M9.5 7V4.5h5V7" {...s} />
        </>
      ) : null}
      {name === 'sun' ? (
        <>
          <Circle cx="12" cy="12" r="4" {...f} />
          <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" {...s} />
        </>
      ) : null}
      {name === 'moon' ? <Path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" {...f} /> : null}
      {name === 'auto' ? (
        <>
          <Rect x="6.5" y="2.5" width="11" height="19" rx="2.6" {...f} />
          <Path d="M10.5 18.5h3" {...s} />
        </>
      ) : null}
      {name === 'clock' ? (
        <>
          <Circle cx="12" cy="12" r="8.5" {...f} />
          <Path d="M12 7.5V12l3 2" {...s} />
        </>
      ) : null}
      {name === 'cash' ? (
        <>
          <Rect x="2.5" y="6" width="19" height="12" rx="2.5" {...f} />
          <Circle cx="12" cy="12" r="2.6" {...s} />
          <Path d="M6 9.5v5M18 9.5v5" {...s} />
        </>
      ) : null}
      {name === 'refresh' ? (
        <>
          <Path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" {...s} />
          <Path d="M19.5 4.5v4h-4" {...s} />
        </>
      ) : null}
      {name === 'alert' ? (
        <>
          <Circle cx="12" cy="12" r="8.5" {...f} />
          <Path d="M12 7.5v5.5M12 16.4h.01" {...s} strokeWidth={2.2} />
        </>
      ) : null}
      {name === 'box' ? (
        <>
          <Path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z" {...f} />
          <Path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" {...s} />
        </>
      ) : null}
      {name === 'lock' ? (
        <>
          <Rect x="4.5" y="10.5" width="15" height="10" rx="2.5" {...f} />
          <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" {...s} />
        </>
      ) : null}
      {name === 'building' ? (
        <>
          <Rect x="4" y="3.5" width="11" height="17" rx="1.5" {...f} />
          <Path d="M15 9.5h4a1 1 0 0 1 1 1v10M7.5 7.5h4M7.5 11h4M7.5 14.5h4M9.5 20.5v-2.5" {...s} />
        </>
      ) : null}
      {name === 'laptop' ? (
        <>
          <Rect x="4.5" y="5" width="15" height="10" rx="1.5" {...f} />
          <Path d="M2.5 18.5h19l-1.5-2.5h-16z" {...s} />
        </>
      ) : null}
      {name === 'tablet' ? (
        <>
          <Rect x="5" y="3" width="14" height="18" rx="2.2" {...f} />
          <Path d="M11 18h2" {...s} />
        </>
      ) : null}
      {name === 'watch' ? (
        <>
          <Path d="M9 6.5 9.8 3h4.4l.8 3.5M9 17.5l.8 3.5h4.4l.8-3.5" {...s} />
          <Rect x="6.5" y="6.5" width="11" height="11" rx="3" {...f} />
          <Path d="M12 9.5V12l1.6 1" {...s} />
        </>
      ) : null}
      {name === 'tv' ? (
        <>
          <Rect x="2.5" y="5" width="19" height="12" rx="1.6" {...f} />
          <Path d="M8 20.5h8M12 17v3.5" {...s} />
        </>
      ) : null}
      {name === 'gamepad' ? (
        <>
          <Path d="M7 7.5h10a4.5 4.5 0 0 1 4.4 5.4l-.7 3.5a2.3 2.3 0 0 1-3.9 1.1L14.5 15h-5l-2.3 2.5a2.3 2.3 0 0 1-3.9-1.1l-.7-3.5A4.5 4.5 0 0 1 7 7.5z" {...f} />
          <Path d="M7.5 10.5v3M6 12h3" {...s} />
          <Circle cx="15.5" cy="11" r="0.9" fill={color} stroke="none" />
          <Circle cx="17.3" cy="12.8" r="0.9" fill={color} stroke="none" />
        </>
      ) : null}
      {name === 'camera' ? (
        <>
          <Path d="M3.5 8.5a2 2 0 0 1 2-2h2.2l1.5-2h5.6l1.5 2h2.2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" {...f} />
          <Circle cx="12" cy="13" r="3.4" {...s} />
        </>
      ) : null}
      {name === 'headphones' ? (
        <>
          <Path d="M4 14v-2a8 8 0 0 1 16 0v2" {...s} />
          <Rect x="3.5" y="13.5" width="4.5" height="7" rx="1.8" {...f} />
          <Rect x="16" y="13.5" width="4.5" height="7" rx="1.8" {...f} />
        </>
      ) : null}
      {name === 'monitor' ? (
        <>
          <Rect x="3" y="4" width="18" height="12.5" rx="1.8" {...f} />
          <Path d="M9 20.5h6M12 16.5v4" {...s} />
        </>
      ) : null}
      {name === 'recycle' ? (
        <>
          <Path d="M8.5 6.2 10.6 3a1.6 1.6 0 0 1 2.8 0l2.2 3.6M17.6 10.3l1.9 3.3a1.6 1.6 0 0 1-1.4 2.4h-4M10 16H5.9a1.6 1.6 0 0 1-1.4-2.4l2-3.4" {...s} />
          <Path d="m15.6 6.6.4-3 2.7 1.4M12.6 18.2l1.5 1.8-1.5 1.8M5.6 9.4l1 2.9-2.9.6" {...s} />
        </>
      ) : null}
      {name === 'grid' ? (
        <>
          <Rect x="3.5" y="3.5" width="7" height="7" rx="2" {...f} />
          <Rect x="13.5" y="3.5" width="7" height="7" rx="2" {...f} />
          <Rect x="3.5" y="13.5" width="7" height="7" rx="2" {...f} />
          <Rect x="13.5" y="13.5" width="7" height="7" rx="2" {...f} />
        </>
      ) : null}
    </Svg>
  );
}
