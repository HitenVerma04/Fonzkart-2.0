// One pickup for the executive: who, where, when, how to pay, and the next step (the website's executive actions:
// check the device, confirm pickup, mark paid, deliver to hub, or report that the pickup failed).
import { useState } from 'react';
import { Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { executiveApi, executiveKeys, useExecutiveOrder } from '@fonzkart/api';
import {
  ORDER_STATUS, displayPhone, failureReasonOf, formatInr, imageUrl, normalizeStatus, priceReviewOf, telHref,
} from '@fonzkart/core';
import { Button, Card, ErrorState, InfoRow, Loading, Notice, StatusBadge, TextPrompt, colors, font, spacing } from '@fonzkart/ui';
import { customerPhone, dayOf, directionsUrl, paymentDetails, slotOf } from '../../src/orderInfo';

type Prompt = 'fail' | 'paid' | null;

export default function Pickup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const order = useExecutiveOrder(id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState<Prompt>(null);

  if (order.isPending) return <Loading />;
  if (order.isError) return <ErrorState message="Could not load this pickup." onRetry={() => order.refetch()} />;

  const o = order.data;
  const status = normalizeStatus(o.status);
  const review = priceReviewOf(o);
  const pay = paymentDetails(o);
  const phone = customerPhone(o);
  const approved = status === ORDER_STATUS.ASSIGNED && review?.decision === 'approved';

  const act = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await task();
      await client.invalidateQueries({ queryKey: executiveKeys.orders });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={order.isRefetching} onRefresh={() => void order.refetch()} />}>
      <Card title={`Order #${o.orderNumber}`} right={<StatusBadge status={o.status} audience="staff" />}>
        <Text style={styles.device}>{o.device}</Text>
        <Text style={styles.price}>{formatInr(o.price)}</Text>
        {status === ORDER_STATUS.PRICE_REVIEW && review ? (
          <Notice text={`You offered ${formatInr(review.requestedPrice)} (quoted ${formatInr(review.quotedPrice)}). Waiting for approval — don't collect the device yet.`} />
        ) : null}
        {approved ? <Notice tone="success" text={`${formatInr(o.price)} approved. Pay the customer and confirm the pickup.`} /> : null}
        {status === ORDER_STATUS.ASSIGNED && review?.decision === 'rejected' ? (
          <Notice tone="error" text={`The revised price was not approved${review.reason ? `: ${review.reason}` : ''}. Check the device again.`} />
        ) : null}
        {status === ORDER_STATUS.FAILED ? <Notice tone="error" text={`Cancelled: ${failureReasonOf(o) ?? 'no reason given'}`} /> : null}
      </Card>

      <Card title="Customer">
        <InfoRow label="Name" value={o.user?.name} />
        <InfoRow label="Phone" value={phone ? displayPhone(phone) : null} />
        <InfoRow label="Address" value={[o.address, o.pincode].filter(Boolean).join(' – ')} />
        <InfoRow label="When" value={[dayOf(o), slotOf(o)].filter(Boolean).join(' · ')} />
        <View style={styles.buttons}>
          {phone ? <View style={styles.flex}><Button title="Call" variant="secondary" onPress={() => void Linking.openURL(telHref(phone))} /></View> : null}
          <View style={styles.flex}><Button title="Directions" variant="secondary" onPress={() => void Linking.openURL(directionsUrl(o))} /></View>
        </View>
      </Card>

      <Card title="Payment to the customer">
        <InfoRow label={pay.paid ? 'Paid' : 'To pay'} value={`${pay.amount} by ${pay.label}`} />
        {pay.lines.map(line => <Text key={line} style={styles.detail} selectable>{line}</Text>)}
      </Card>

      {o.verificationImages.length ? (
        <Card title="Photos">
          <View style={styles.photos}>
            {o.verificationImages.map(src => (
              <Image key={src} source={{ uri: imageUrl(src) ?? undefined }} style={styles.photo} />
            ))}
          </View>
        </Card>
      ) : null}

      {error ? <Notice tone="error" text={error} /> : null}
      <View style={styles.actions}>
        {status === ORDER_STATUS.ASSIGNED && !approved ? (
          <Button title="Check the device" onPress={() => router.push({ pathname: '/rider/check/[id]', params: { id: o.id } })} />
        ) : null}
        {approved ? (
          <Button title={`Confirm pickup at ${formatInr(o.price)}`} loading={busy}
            onPress={() => void act(() => executiveApi.setStatus(o.id, 'picked_up'))} />
        ) : null}
        {(status === ORDER_STATUS.PICKED_UP || status === ORDER_STATUS.COMPLETED) && !pay.paid ? (
          <Button title={`Mark ${pay.amount} as paid`} loading={busy} onPress={() => setPrompt('paid')} />
        ) : null}
        {status === ORDER_STATUS.PICKED_UP ? (
          <Button title="Delivered to the hub" variant="secondary" loading={busy}
            onPress={() => void act(() => executiveApi.setStatus(o.id, 'completed'))} />
        ) : null}
        {status === ORDER_STATUS.ASSIGNED || status === ORDER_STATUS.PRICE_REVIEW ? (
          <Button title="Could not pick up" variant="link" onPress={() => setPrompt('fail')} />
        ) : null}
      </View>

      <TextPrompt
        visible={prompt === 'paid'}
        title="Customer paid"
        message="For UPI, bank transfer or a gift card, enter the transaction or gift-card order ID (never the gift card code)."
        label="Reference (optional for cash)"
        confirmLabel="Mark paid"
        onClose={() => setPrompt(null)}
        onSubmit={reference => { setPrompt(null); void act(() => executiveApi.markPaid(o.id, reference || undefined)); }}
      />
      <TextPrompt
        visible={prompt === 'fail'}
        title="Could not pick up"
        message="The order is cancelled and your partner is told why."
        label="Reason"
        placeholder="e.g. Customer not reachable"
        confirmLabel="Cancel pickup"
        required
        onClose={() => setPrompt(null)}
        onSubmit={reason => { setPrompt(null); void act(() => executiveApi.setStatus(o.id, 'failed', reason)); }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg, maxWidth: 720, width: '100%', alignSelf: 'center' },
  device: { fontSize: font.heading, fontWeight: '800', color: colors.navy },
  price: { fontSize: 28, fontWeight: '800', color: colors.green },
  buttons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  flex: { flex: 1 },
  detail: { fontSize: font.body, color: colors.text },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { width: 96, height: 96, borderRadius: 8, backgroundColor: colors.placeholder },
  actions: { gap: spacing.md },
});
