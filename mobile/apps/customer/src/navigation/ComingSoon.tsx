// A service that is not offered yet (Buy, Repair, Screen Guard): a floating icon in a glowing green disc and a way
// back to selling.
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { makeStyles, useColors } from '@fonzkart/ui';
import { useLoop } from '../categoryArt/motion';
import { Appear, Button, Icon, TabTitle, type, useDesign, useTabBarSpace, type IconName } from '../design';

export function ComingSoon({ icon, title, message, tab }: { icon: IconName; title: string; message: string; tab?: boolean }) {
  const colors = useColors();
  const d = useDesign();
  const styles = useStyles();
  const router = useRouter();
  const bottom = useTabBarSpace();
  const t = useLoop(3);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: -8 * t.value }] }));
  return (
    <View style={styles.screen}>
      {tab ? <TabTitle title={title} /> : null}
      <View style={[styles.page, tab && { paddingBottom: bottom }]}>
        <Animated.View style={[styles.badge, { boxShadow: d.shadow.green }, float]}>
          <Icon name={icon} color={colors.green} size={48} filled />
        </Animated.View>
        <Appear index={0}><Text style={styles.soon}>Coming soon</Text></Appear>
        <Appear index={1}><Text style={styles.title}>{title}</Text></Appear>
        <Appear index={2}><Text style={styles.message}>{message}</Text></Appear>
        <Appear index={3} style={styles.button}>
          <Button title="Sell a device" icon="sell" onPress={() => router.navigate('/')} />
        </Appear>
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  badge: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.greenTint, borderWidth: 1, borderColor: colors.greenBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  soon: { ...type.tiny, textTransform: 'uppercase', color: colors.green, textAlign: 'center' },
  title: { ...type.title, color: colors.navy, textAlign: 'center' },
  message: { ...type.body, color: colors.muted, textAlign: 'center', maxWidth: 320 },
  button: { marginTop: 18, alignSelf: 'stretch', maxWidth: 320, width: '100%' },
}));
