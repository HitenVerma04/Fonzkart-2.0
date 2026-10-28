// Orders in the Customer app's style. Labels, tones and steps still come from @fonzkart/core (the website's
// lib/order-status.ts), so an order reads the same everywhere.
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { formatInr, statusLabel, statusTone, type TrackerStep } from '@fonzkart/core';
import { formatDateTime, makeStyles, useColors } from '@fonzkart/ui';
import { Icon } from './Icon';
import { Tap } from './Tap';
import { radii, type, useDesign } from './tokens';

export function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const styles = useStyles();
  const tone = colors.tones[statusTone(status)];
  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <View style={[styles.badgeDot, { backgroundColor: tone.text }]} />
      <Text style={[styles.badgeText, { color: tone.text }]}>{statusLabel(status, 'customer')}</Text>
    </View>
  );
}

export function OrderCard({ orderNumber, device, price, status, date, subtitle, onPress }: {
  orderNumber: number;
  device: string;
  price: number;
  status: string;
  date: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const d = useDesign();
  const styles = useStyles();
  return (
    <Tap
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`Order ${orderNumber}, ${device}, ${statusLabel(status, 'customer')}`}
      style={[styles.card, { boxShadow: d.shadow.sm }]}
    >
      <View style={styles.cardTop}>
        <View style={styles.deviceIcon}>
          <Icon name="auto" color={colors.green} size={22} filled />
        </View>
        <View style={styles.cardTitle}>
          <Text style={styles.device} numberOfLines={2}>{device}</Text>
          <Text style={styles.number}>Order #{orderNumber}</Text>
        </View>
        <Icon name="chevronRight" color={colors.muted} size={18} />
      </View>
      {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      <View style={styles.divider} />
      <View style={styles.cardBottom}>
        <StatusBadge status={status} />
        <View style={styles.priceBox}>
          <Text style={styles.price}>{formatInr(price)}</Text>
          <Text style={styles.date}>{formatDateTime(date)}</Text>
        </View>
      </View>
    </Tap>
  );
}

/** The order's progress as a timeline; the current step pulses. */
export function Tracker({ steps }: { steps: TrackerStep[] }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View accessibilityRole="list">
      {steps.map((step, i) => {
        const done = step.state === 'done';
        const failed = step.state === 'failed';
        const current = step.state === 'current';
        return (
          <View key={step.key} style={styles.step} accessibilityLabel={`${step.label}: ${step.state}${step.detail ? `. ${step.detail}` : ''}`}>
            <View style={styles.rail}>
              <View style={[styles.dot, done && styles.dotDone, current && styles.dotCurrent, failed && styles.dotFailed]}>
                {current ? <Pulse /> : null}
                {done ? <Icon name="check" color={colors.white} size={14} strokeWidth={3} /> : null}
                {failed ? <Text style={styles.failedMark}>!</Text> : null}
              </View>
              {i < steps.length - 1 ? <View style={[styles.line, done && { backgroundColor: colors.green }]} /> : null}
            </View>
            <View style={styles.stepBody}>
              <Text style={[styles.stepLabel, step.state === 'upcoming' && { color: colors.muted, fontWeight: '600' }, current && { color: colors.green }]}>
                {step.label}
              </Text>
              {step.detail ? <Text style={styles.stepDetail}>{step.detail}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Pulse() {
  const colors = useColors();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
  }, [t]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - t.value), transform: [{ scale: 1 + t.value * 0.9 }] }));
  return (
    <>
      <Animated.View style={[{ position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: colors.green }, ring]} />
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white }} />
    </>
  );
}

const useStyles = makeStyles(colors => ({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { ...type.tiny, fontSize: 10.5, textTransform: 'uppercase' },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deviceIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, gap: 2 },
  device: { ...type.label, fontSize: 16, color: colors.navy },
  number: { ...type.small, fontSize: 12, color: colors.muted },
  subtitle: { ...type.small, color: colors.textSoft },
  divider: { height: 1, backgroundColor: colors.border },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  priceBox: { alignItems: 'flex-end' },
  price: { ...type.heading, fontWeight: '800', color: colors.green },
  date: { ...type.small, fontSize: 11, color: colors.muted },
  step: { flexDirection: 'row', gap: 14 },
  rail: { alignItems: 'center', width: 26 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.track },
  dotDone: { backgroundColor: colors.green, borderColor: colors.green },
  dotCurrent: { backgroundColor: colors.green, borderColor: colors.green },
  dotFailed: { backgroundColor: colors.danger, borderColor: colors.danger },
  failedMark: { color: colors.white, fontWeight: '800', fontSize: 14 },
  line: { width: 2, flex: 1, minHeight: 20, backgroundColor: colors.track, marginVertical: 3, borderRadius: 1 },
  stepBody: { flex: 1, paddingBottom: 18, gap: 2, paddingTop: 2 },
  stepLabel: { ...type.label, fontSize: 15, color: colors.text },
  stepDetail: { ...type.small, color: colors.muted },
}));
