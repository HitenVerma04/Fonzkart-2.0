// The customer tracker: the website's trackerSteps() for this order, refreshed every 20 s and when the app comes
// back, so a change made by the executive, partner or admin (in their app or on the website) shows here.
import { Linking, RefreshControl, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMyOrder } from '@fonzkart/api';
import {
  displayPhone, failureReasonOf, formatInr, isFailed, parseAnswers, payoutOf, priceReviewOf, telHref, trackerSteps,
} from '@fonzkart/core';
import { formatDateTime, makeStyles, useColors } from '@fonzkart/ui';
import {
  Appear, Button, Card, ErrorState, IconBadge, InfoRow, Notice, Page, radii, SkeletonCard, SkeletonScreen, StatusBadge,
  Tracker, type, useDesign,
} from '../../src/design';

export default function OrderTracker() {
  const colors = useColors();
  const d = useDesign();
  const styles = useStyles();
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const order = useMyOrder(id);

  if (order.isPending) {
    return (
      <Page>
        <SkeletonScreen label="Loading your order">
          <SkeletonCard lines={2} tall />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </SkeletonScreen>
      </Page>
    );
  }
  if (order.isError) return <ErrorState message="Could not load this order." error={order.error} onRetry={() => order.refetch()} />;

  const o = order.data;
  const answers = parseAnswers(o.answers);
  const payout = payoutOf(o);
  const review = priceReviewOf(o);
  const failure = isFailed(o.status) ? failureReasonOf(o) : null;
  const slot = answers.isExpress ? 'Express pickup' : typeof answers.scheduledSlot === 'string' ? answers.scheduledSlot : '';
  const day = typeof answers.scheduledDate === 'string' ? formatDateTime(answers.scheduledDate).split(',').slice(0, 1).join('') : '';

  return (
    <Page refreshControl={<RefreshControl refreshing={order.isRefetching} onRefresh={() => void order.refetch()}
      colors={[colors.green]} tintColor={colors.green} />}>
      {placed ? <Appear><Notice tone="success" text={`Pickup booked! Order #${o.orderNumber}. We'll assign an executive shortly.`} /></Appear> : null}

      <Appear index={1}>
        <View style={[styles.summary, { boxShadow: d.shadow.md }]}>
          <View style={styles.top}>
            <Text style={styles.number}>Order #{o.orderNumber}</Text>
            <StatusBadge status={o.status} />
          </View>
          <Text style={styles.device}>{o.device}</Text>
          <Text style={styles.priceLabel}>Your price</Text>
          <Text style={styles.price}>{formatInr(o.price)}</Text>
          {review?.decision === 'pending' ? (
            <Notice text={`The executive offered ${formatInr(review.requestedPrice)} after checking the device. Fonzkart is reviewing it.`} />
          ) : null}
          {failure ? <Notice tone="error" text={`Cancelled: ${failure}`} /> : null}
        </View>
      </Appear>

      <Appear index={2}>
        <Card title="Progress" icon="truck">
          <Tracker steps={trackerSteps(o)} />
        </Card>
      </Appear>

      {o.executive ? (
        <Appear index={3}>
          <Card title="Your executive" icon="user">
            <View style={styles.executive}>
              <IconBadge name="profile" size={44} />
              <View style={styles.executiveText}>
                <Text style={styles.value}>{o.executive.name}</Text>
                <Text style={styles.muted}>{displayPhone(o.executive.phone)}</Text>
              </View>
            </View>
            <Button title="Call" variant="secondary" icon="phone" onPress={() => void Linking.openURL(telHref(o.executive!.phone))} />
          </Card>
        </Appear>
      ) : null}

      <Appear index={4}>
        <Card title="Pickup" icon="location">
          <InfoRow icon="location" label="Address" value={o.address || (typeof answers.detectedAddress === 'string' ? answers.detectedAddress : '')} />
          {o.pincode ? <InfoRow icon="box" label="Pincode" value={o.pincode} /> : null}
          {day || slot ? <InfoRow icon="clock" label="When" value={[day, slot].filter(Boolean).join(' · ')} /> : null}
          <InfoRow icon="wallet" label="Payment" value={payout.paid
            ? `${formatInr(payout.amount)} paid by ${payout.methodLabel}${payout.paidAt ? ` on ${formatDateTime(payout.paidAt)}` : ''}`
            : `${payout.methodLabel}`} />
          <InfoRow icon="sparkle" label="Placed" value={formatDateTime(o.date)} />
        </Card>
      </Appear>
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  summary: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 6 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  number: { ...type.small, fontWeight: '700', color: colors.muted },
  device: { ...type.title, fontSize: 21, color: colors.navy },
  priceLabel: { ...type.tiny, textTransform: 'uppercase', color: colors.muted, marginTop: 8 },
  price: { fontSize: 36, lineHeight: 42, fontWeight: '800', letterSpacing: -1, color: colors.green },
  executive: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  executiveText: { flex: 1, gap: 2 },
  muted: { ...type.small, color: colors.muted },
  value: { ...type.body, fontWeight: '700', color: colors.text },
}));
