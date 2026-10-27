// A tab whose service is not offered yet (Buy, Repair): a floating icon in Fonzkart green and a way back to selling.
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Button, font, makeStyles, spacing, useColors } from '@fonzkart/ui';
import { useLoop } from '../categoryArt/motion';
import { TabIcon, type TabIconName } from './TabIcon';

export function ComingSoon({ icon, title, message }: { icon: TabIconName; title: string; message: string }) {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const t = useLoop(3);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * t.value }] }));
  return (
    <View style={styles.page}>
      <Animated.View style={[styles.badge, float]}>
        <TabIcon name={icon} color={colors.green} size={44} focused />
      </Animated.View>
      <Text style={styles.soon}>Coming soon</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.button}>
        <Button title="Sell a device" onPress={() => router.navigate('/')} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  badge: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  soon: { fontSize: font.tiny, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.green },
  title: { fontSize: font.title, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  message: { fontSize: font.body, color: colors.muted, textAlign: 'center', maxWidth: 320 },
  button: { marginTop: spacing.md, alignSelf: 'stretch', maxWidth: 320, width: '100%' },
}));
