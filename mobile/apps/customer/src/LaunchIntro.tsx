// The launch animation, played once per app start over the first screen. It begins exactly like the native splash
// (the Fonzkart phone alone, centred), then the phone pops with a green glow, the ONZKA₹T lettering is unveiled
// beside it, a light sweeps across, and the whole mark lifts away to reveal the app. About 2.3 seconds.
import { useEffect, useState } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { useColors, useTheme } from '@fonzkart/ui';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const WORDMARK = require('../../../brand/fonzkart_wordmark.png');
const WORDMARK_DARK = require('../../../brand/fonzkart_wordmark_dark.png');
const RATIO = 1408 / 346; // wordmark width / height
const PHONE = 190 / 1408; // share of the wordmark's width taken by the F-phone

export function LaunchIntro() {
  const colors = useColors();
  const { scheme } = useTheme();
  const { width: screen } = useWindowDimensions();
  const [done, setDone] = useState(false);
  const height = Math.min(64, (screen * 0.74) / RATIO);
  const full = height * RATIO;
  const phone = full * PHONE;

  const reveal = useSharedValue(phone); // visible width of the wordmark
  const pop = useSharedValue(1.6); // starts at the native splash's size
  const glow = useSharedValue(0);
  const sweep = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    SplashScreen.hide();
    const ease = Easing.bezier(0.22, 1, 0.36, 1);
    pop.value = withSequence(withTiming(1.75, { duration: 180 }), withSpring(1, { damping: 22, stiffness: 160 }));
    glow.value = withDelay(120, withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 600 })));
    reveal.value = withDelay(520, withTiming(full, { duration: 620, easing: ease }));
    sweep.value = withDelay(1150, withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }));
    exit.value = withDelay(1850, withTiming(1, { duration: 420, easing: Easing.in(Easing.quad) }, finished => {
      if (finished) runOnJS(setDone)(true);
    }));
  }, [full, pop, glow, reveal, sweep, exit]);

  const overlay = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const mark = useAnimatedStyle(() => ({ transform: [{ scale: pop.value * (1 + exit.value * 0.35) }], opacity: 1 - exit.value * 0.6 }));
  const clip = useAnimatedStyle(() => ({ width: reveal.value }));
  const halo = useAnimatedStyle(() => ({ opacity: glow.value * 0.55, transform: [{ scale: 0.6 + glow.value * 1.6 }] }));
  const light = useAnimatedStyle(() => ({ transform: [{ translateX: -full * 0.4 + sweep.value * full * 1.4 }], opacity: sweep.value < 1 ? 1 : 0 }));

  if (done) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background }, overlay]}
      accessibilityLabel="Fonzkart">
      <Animated.View style={[styles.halo, { width: height * 2.4, height: height * 2.4, borderRadius: height * 1.2, backgroundColor: colors.green }, halo]} />
      <Animated.View style={mark}>
        <Animated.View style={[{ height, overflow: 'hidden' }, clip]}>
          <Image source={scheme === 'dark' ? WORDMARK_DARK : WORDMARK} style={{ width: full, height }} resizeMode="contain" />
          <Animated.View style={[styles.light, { height, width: full * 0.28 }, light]} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  halo: { position: 'absolute', boxShadow: '0px 0px 60px rgba(34,197,94,0.9)' },
  light: { position: 'absolute', top: 0, left: 0, backgroundImage: 'linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.75) 50%, transparent 100%)' },
});
