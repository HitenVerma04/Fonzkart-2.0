// "Liquid glass" for floating and highlighted surfaces: a translucent fill, a bright hairline edge, a soft sheen on
// the top half and a shadow. No live blur (costly on Android), so content behind stays readable and scrolling smooth.
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { radii, useDesign } from './tokens';

export function Glass({ children, style, strong, radius = radii.lg, shadow = 'md', ...view }: ViewProps & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Nearly opaque, for bars that float over busy content. */
  strong?: boolean;
  radius?: number;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
}) {
  const d = useDesign();
  return (
    <View
      {...view}
      style={[
        {
          borderRadius: radius,
          backgroundColor: strong ? d.glass.strongFill : d.glass.fill,
          borderWidth: 1,
          borderColor: d.glass.border,
          boxShadow: shadow === 'none' ? undefined : d.shadow[shadow],
        },
        style,
      ]}
    >
      {/* The sheen covers the whole surface, border included, so its corners round exactly like the surface's own
          (a shorter layer gets a tighter curve and pokes out at the corners); the gradient itself fades out by 60%. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderRadius: radius, backgroundImage: d.glass.sheen }}
      />
      {children}
    </View>
  );
}
