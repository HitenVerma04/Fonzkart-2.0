// A refurbished device: its picture, condition, what comes with it, and Buy now.
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DEVICE_GRADES, discountPercent, useRefurbishedStore, useSession } from '@fonzkart/api';
import { makeStyles } from '@fonzkart/ui';
import { lerp, useLoop } from '../../src/categoryArt/motion';
import {
  ActionBar, Appear, Button, Card, EmptyState, ErrorState, InfoRow, Page, ProductImage, radii, SkeletonCard, type, useDesign,
} from '../../src/design';
import { GradeBadge } from '../../src/shop/GradeBadge';
import { PriceBlock } from '../../src/shop/ShopBits';

export default function RefurbishedDetail() {
  const styles = useStyles();
  const d = useDesign();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const store = useRefurbishedStore();
  const t = useLoop(4.4, 0, 'motion');
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: lerp(-6, 6, t.value) }] }));

  if (store.isPending) return <Page><SkeletonCard lines={2} tall /><SkeletonCard lines={4} /></Page>;
  if (store.isError) return <ErrorState error={store.error} onRetry={() => store.refetch()} />;
  const device = store.data.items.find(i => i.id === id);
  if (!device) {
    return (
      <EmptyState icon="buy" title="This device has been sold" message="See what else is in stock."
        action={{ label: 'Browse devices', onPress: () => router.navigate('/buy') }} />
    );
  }
  const grade = DEVICE_GRADES.find(g => g.id === device.grade);
  const saving = device.mrp - device.price;

  const buy = () => {
    if (session.status === 'signedIn') router.push({ pathname: '/refurbished/checkout', params: { id: device.id } });
    else router.push({ pathname: '/account/sign-in', params: { returnTo: `/refurbished/${device.id}` } });
  };

  return (
    <View style={styles.screen}>
      <Page>
        <Appear>
          <View style={[styles.stage, { boxShadow: d.shadow.md }]}>
            <Animated.View style={float}>
              <ProductImage uri={device.imageUrl} label={device.name} size={220} />
            </Animated.View>
          </View>
        </Appear>
        <Appear index={1} style={styles.titleBlock}>
          <GradeBadge grade={device.grade} />
          <Text style={styles.name}>{device.name}</Text>
          <Text style={styles.storage}>{device.storage}</Text>
          <PriceBlock price={device.price} mrp={device.mrp} size="lg" />
          {discountPercent(device.mrp, device.price) ? <Text style={styles.saving}>You save ₹{saving.toLocaleString('en-IN')} on a new one</Text> : null}
          {device.stock <= 2 ? <Text style={styles.few}>Only {device.stock} left</Text> : null}
        </Appear>
        <Appear index={2}>
          <Card title={`Condition: ${grade?.label ?? device.grade}`} icon="sparkle">
            <Text style={styles.body}>{grade?.detail}</Text>
          </Card>
        </Appear>
        <Appear index={3}>
          <Card title="What you get" icon="shield">
            {device.warrantyMonths > 0 ? <InfoRow icon="shield" label="Warranty" value={`${device.warrantyMonths} months`} /> : null}
            <InfoRow icon="check" label="Testing" value="Checked and tested by Fonzkart" />
            <InfoRow icon="truck" label="Delivery" value="Free" />
            <InfoRow icon="cash" label="Payment" value="Cash on delivery" />
          </Card>
        </Appear>
      </Page>
      <ActionBar>
        <View style={styles.flex}><Button title="Buy now" icon="buy" onPress={buy} /></View>
      </ActionBar>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  stage: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderRadius: radii.xl, paddingVertical: 24 },
  titleBlock: { gap: 4 },
  name: { ...type.title, color: colors.navy, marginTop: 4 },
  storage: { ...type.body, color: colors.muted },
  saving: { ...type.small, fontWeight: '600', color: colors.green },
  few: { ...type.small, fontWeight: '700', color: colors.warning.text },
  body: { ...type.body, color: colors.textSoft },
}));
