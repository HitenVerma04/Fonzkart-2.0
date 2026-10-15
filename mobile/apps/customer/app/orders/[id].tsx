// The customer tracker: the website's trackerSteps() for this order, refreshed every 20 s and when the app comes
// back, so a change made by the executive, partner or admin (in their app or on the website) shows here.
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMyOrder } from '@fonzkart/api';
import {
  displayPhone, failureReasonOf, formatInr, isFailed, parseAnswers, payoutOf, priceReviewOf, telHref, trackerSteps,
} from '@fonzkart/core';
import { Button, ErrorState, Loading, Notice, StatusBadge, Tracker, colors, font, formatDateTime, radius, spacing } from '@fonzkart/ui';
import { PAGE_PADDING } from '../../src/grid';

export default function OrderTracker() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const order = useMyOrder(id);

  if (order.isPending) return <Loading label="Loading your order…" />;
  if (order.isError) return <ErrorState message="Could not load this order." onRetry={() => order.refetch()} />;

  const o = order.data;
  const answers = parseAnswers(o.answers);
  const payout = payoutOf(o);
  const review = priceReviewOf(o);
  const failure = isFailed(o.status) ? failureReasonOf(o) : null;
  const slot = answers.isExpress ? 'Express pickup' : typeof answers.scheduledSlot === 'string' ? answers.scheduledSlot : '';
  const day = typeof answers.scheduledDate === 'string' ? formatDateTime(answers.scheduledDate).split(',').slice(0, 1).join('') : '';

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={order.isRefetching} onRefresh={() => void order.refetch()} />}
    >
      {placed ? <Notice tone="success" text={`Pickup booked! Order #${o.orderNumber}. We'll assign an executive shortly.`} /> : null}

      <View style={styles.card}>
        <View style={styles.top}>
          <Text style={styles.number}>Order #{o.orderNumber}</Text>
          <StatusBadge status={o.status} />
        </View>
        <Text style={styles.device}>{o.device}</Text>
        <Text style={styles.price}>{formatInr(o.price)}</Text>
        {review?.decision === 'pending' ? (
          <Notice text={`The executive offered ${formatInr(review.requestedPrice)} after checking the device. Fonzkart is reviewing it.`} />
        ) : null}
        {failure ? <Notice tone="error" text={`Cancelled: ${failure}`} /> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progress</Text>
        <Tracker steps={trackerSteps(o)} />
      </View>

      {o.executive ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your executive</Text>
          <Text style={styles.value}>{o.executive.name}</Text>
          <Text style={styles.muted}>{displayPhone(o.executive.phone)}</Text>
          <Button title="Call" variant="secondary" onPress={() => void Linking.openURL(telHref(o.executive!.phone))} />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pickup</Text>
        <Row label="Address" value={o.address || (typeof answers.detectedAddress === 'string' ? answers.detectedAddress : '')} />
        {o.pincode ? <Row label="Pincode" value={o.pincode} /> : null}
        {day || slot ? <Row label="When" value={[day, slot].filter(Boolean).join(' · ')} /> : null}
        <Row label="Payment" value={payout.paid
          ? `${formatInr(payout.amount)} paid by ${payout.methodLabel}${payout.paidAt ? ` on ${formatDateTime(payout.paidAt)}` : ''}`
          : `${payout.methodLabel}`} />
        <Row label="Placed" value={formatDateTime(o.date)} />
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.value}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { fontSize: font.small, fontWeight: '700', color: colors.muted },
  device: { fontSize: font.heading, fontWeight: '800', color: colors.navy },
  price: { fontSize: 28, fontWeight: '800', color: colors.green },
  cardTitle: { fontSize: font.heading, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  row: { gap: 2, marginBottom: spacing.xs },
  muted: { fontSize: font.small, color: colors.muted },
  value: { fontSize: font.body, fontWeight: '600', color: colors.text },
});
