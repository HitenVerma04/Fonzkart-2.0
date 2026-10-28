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
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%', borderRadius: radius, backgroundImage: d.glass.sheen }}
      />
      {children}
    </View>
  );
}
