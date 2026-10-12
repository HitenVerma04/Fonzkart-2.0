import { Image, type ImageStyle, type StyleProp } from 'react-native';

// The official logo files in mobile/brand/ (cart full of devices, green F-phone, navy ONZKA₹T wordmark).
const LOGOS = {
  horizontal: { source: require('../../../brand/fonzkart_lockup_horizontal.png'), ratio: 2500 / 569 },
  stacked: { source: require('../../../brand/fonzkart_lockup_stacked.png'), ratio: 1408 / 1001 },
  wordmark: { source: require('../../../brand/fonzkart_wordmark.png'), ratio: 1408 / 346 },
  cart: { source: require('../../../brand/fonzkart_cart_icon.png'), ratio: 722 / 585 },
  f: { source: require('../../../brand/fonzkart_f_icon.png'), ratio: 192 / 346 },
} as const;

export type LogoVariant = keyof typeof LOGOS;

export function Logo({ variant = 'horizontal', height = 40, style }: {
  variant?: LogoVariant;
  height?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const logo = LOGOS[variant];
  return (
    <Image
      source={logo.source}
      style={[{ height, width: height * logo.ratio }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Fonzkart"
    />
  );
}
