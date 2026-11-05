// The gradient header of the Buy and Repair tabs: the title, its promises, and the service's glyph floating to one side.
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { makeStyles } from '@fonzkart/ui';
import { lerp, useLoop } from '../categoryArt/motion';
import { Appear, Icon, radii, type, useDesign } from '../design';
import { ServiceGlyph, type ServiceGlyphName } from '../launchGlyphs';

export function ServiceHero({ glyph, title, promises }: { glyph: ServiceGlyphName; title: string; promises: string[] }) {
  const styles = useStyles();
  const d = useDesign();
  const t = useLoop(5, 0, 'motion');
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: lerp(-5, 5, t.value) }, { rotate: `${lerp(-4, 4, t.value)}deg` }] }));
  return (
    <Appear style={[styles.hero, { backgroundImage: d.heroGradient }]}>
      <Animated.View style={[styles.art, float]}>
        <ServiceGlyph name={glyph} color="rgba(255,255,255,0.5)" size={104} />
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.promises}>
        {promises.map(p => (
          <View key={p} style={styles.promise}>
            <Icon name="check" color={d.heroAccent} size={15} strokeWidth={2.6} />
            <Text style={styles.promiseText}>{p}</Text>
          </View>
        ))}
      </View>
    </Appear>
  );
}

const useStyles = makeStyles(() => ({
  hero: { borderRadius: radii.xl, padding: 20, gap: 4, overflow: 'hidden' },
  art: { position: 'absolute', right: 8, top: 10 },
  title: { ...type.title, fontSize: 28, lineHeight: 34, color: '#ffffff', maxWidth: '72%' },
  promises: { gap: 6, marginTop: 10 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promiseText: { ...type.small, fontWeight: '600', color: '#ffffff', flexShrink: 1 },
}));
