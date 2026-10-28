// Press feedback for everything tappable: the item springs down a little while pressed and back when released.
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from './tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Tap({ scaleTo = 0.97, style, children, onPressIn, onPressOut, ...props }: Omit<PressableProps, 'style' | 'children'> & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: 1 - (1 - scaleTo) * pressed.value }] }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={e => {
        pressed.value = withSpring(1, motion.press);
        onPressIn?.(e);
      }}
      onPressOut={e => {
        pressed.value = withSpring(0, motion.press);
        onPressOut?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
