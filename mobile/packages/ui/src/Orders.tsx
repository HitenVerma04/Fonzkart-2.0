// Order building blocks shared by the three apps. Labels, steps and payout state come from the website's own
// lib/order-status.ts (copied into @fonzkart/core), so an order reads the same on the website and in every app.
import { Pressable, Text, View } from 'react-native';
import { formatInr, statusLabel, statusTone, type Tone, type TrackerStep } from '@fonzkart/core';
import { makeStyles, useColors } from './ThemeContext';
import { font, radius, spacing, type Palette } from './theme';


export function StatusBadge({ status, audience = 'customer' }: { status: string; audience?: 'customer' | 'staff' }) {
  const colors = useColors();
  const styles = useStyles();
  const tone = colors.tones[statusTone(status)];
  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <Text style={[styles.badgeText, { color: tone.text }]}>{statusLabel(status, audience)}</Text>
    </View>
  );
}

/** "12 Oct 2026, 4:05 PM" in the phone's time zone. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${h % 12 || 12}:${minutes} ${h < 12 ? 'AM' : 'PM'}`;
}

export function OrderCard({ orderNumber, device, price, status, date, subtitle, audience, onPress }: {
  orderNumber: number;
  device: string;
  price: number;
  status: string;
  date: string;
  subtitle?: string;
  audience?: 'customer' | 'staff';
  onPress?: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Order ${orderNumber}, ${device}, ${statusLabel(status, audience)}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.number}>#{orderNumber}</Text>
        <StatusBadge status={status} audience={audience} />
      </View>
      <Text style={styles.device}>{device}</Text>
      {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      <View style={styles.cardBottom}>
        <Text style={styles.price}>{formatInr(price)}</Text>
        <Text style={styles.date}>{formatDateTime(date)}</Text>
      </View>
    </Pressable>
  );
}

const stepColor = (colors: Palette, state: TrackerStep['state']) =>
  state === 'done' ? colors.green : state === 'current' ? '#2563eb' : state === 'failed' ? colors.danger : colors.track;

/** The customer tracker (trackerSteps): one row per stage. */
export function Tracker({ steps }: { steps: TrackerStep[] }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View accessibilityRole="list">
      {steps.map((step, i) => (
        <View key={step.key} style={styles.step} accessibilityLabel={`${step.label}: ${step.state}${step.detail ? `. ${step.detail}` : ''}`}>
          <View style={styles.rail}>
            <View style={[styles.dot, { backgroundColor: stepColor(colors, step.state) }]}>
              <Text style={styles.dotText}>{step.state === 'done' ? '✓' : step.state === 'failed' ? '!' : ''}</Text>
            </View>
            {i < steps.length - 1 ? <View style={[styles.line, step.state === 'done' && { backgroundColor: colors.green }]} /> : null}
          </View>
          <View style={styles.stepBody}>
            <Text style={[styles.stepLabel, step.state === 'upcoming' && { color: colors.muted }]}>{step.label}</Text>
            {step.detail ? <Text style={styles.stepDetail}>{step.detail}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: font.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.xs },
  pressed: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { fontSize: font.small, fontWeight: '700', color: colors.muted },
  device: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: font.small, color: colors.muted },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.xs },
  price: { fontSize: font.heading, fontWeight: '800', color: colors.green },
  date: { fontSize: font.tiny, color: colors.muted },
  step: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 24 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  line: { width: 2, flex: 1, minHeight: 18, backgroundColor: colors.border, marginVertical: 2 },
  stepBody: { flex: 1, paddingBottom: spacing.lg, gap: 2 },
  stepLabel: { fontSize: font.body, fontWeight: '700', color: colors.text },
  stepDetail: { fontSize: font.small, color: colors.muted },
}));
