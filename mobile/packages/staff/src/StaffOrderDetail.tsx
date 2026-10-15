// One order for staff (Partner app, Admin app): the website's order details and actions of the admin Orders page,
// offered only when the signed-in role may use them (the server checks again). Everything a partner, RM, zonal head
// or admin changes here shows on the website, in the executive's app and on the customer's tracker.
import { useState, type ReactElement } from 'react';
import { Alert, Image, Linking, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { staffOrdersApi, useStaffOrders, type OrderAction } from '@fonzkart/api';
import {
  ORDER_STATUS, displayPhone, failureReasonOf, formatInr, imageUrl, isAssignable, isCompleted, isFailed, normalizeStatus,
  parseAnswers, payoutOf, priceReviewOf, telHref, trackerSteps,
} from '@fonzkart/core';
import {
  Button, Card, EmptyState, ErrorState, InfoRow, ListPicker, Loading, Notice, StatusBadge, TextPrompt, Tracker, colors, font,
  formatDateTime, spacing,
} from '@fonzkart/ui';

type Prompt = 'approveOther' | 'reject' | 'fail' | 'paid' | null;

export function StaffOrderDetail({ orderId, onDeleted }: { orderId: string; onDeleted?: () => void }) {
  const client = useQueryClient();
  const page = useStaffOrders(true);
  const [picker, setPicker] = useState<'rider' | 'partner' | null>(null);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (page.isPending) return <Loading />;
  if (page.isError) return <ErrorState onRetry={() => page.refetch()} />;
  const o = page.data.orders.find(x => x.id === orderId);
  if (!o) return <EmptyState message="This order is no longer in your list (it may have been moved to another partner or deleted)." />;

  const { permissions: can, riders, partners } = page.data;
  const status = normalizeStatus(o.status);
  const review = priceReviewOf(o);
  const payout = payoutOf(o);
  const answers = parseAnswers(o.answers);
  const riderAnswers = parseAnswers(o.riderAnswers);
  const executive = riders.find(r => r.id === o.riderId);
  const partner = partners.find(p => p.id === o.partnerId);
  const phone = (typeof answers.phone === 'string' && answers.phone) || o.user?.phone || null;

  const run = async (label: string, task: () => Promise<unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      setMessage({ tone: 'success', text: label });
      await client.invalidateQueries({ queryKey: ['staff'] });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong. Try again.' });
    } finally {
      setBusy(false);
    }
  };
  const act = (label: string, action: OrderAction) => run(label, () => staffOrdersApi.act(o.id, action));

  const confirmDelete = () => {
    const go = () => void run('Order deleted.', async () => {
      await staffOrdersApi.remove(o.id);
      onDeleted?.();
    });
    const text = `Delete order #${o.orderNumber}? This cannot be undone.`;
    if (Platform.OS === 'web') {
      if ((globalThis as { confirm?: (t: string) => boolean }).confirm?.(text)) go();
    } else {
      Alert.alert('Delete order', text, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={page.isRefetching} onRefresh={() => void page.refetch()} />}>
      <Card title={`Order #${o.orderNumber}`} right={<StatusBadge status={o.status} audience="staff" />}>
        <Text style={styles.device}>{o.device}</Text>
        <Text style={styles.price}>{formatInr(o.price)}</Text>
        {status === ORDER_STATUS.PRICE_REVIEW && review ? (
          <Notice text={`The executive offers ${formatInr(review.requestedPrice)} instead of ${formatInr(review.quotedPrice)}.`} />
        ) : null}
        {isFailed(status) ? <Notice tone="error" text={`Failed: ${failureReasonOf(o) ?? 'no reason given'}`} /> : null}
        <Text style={styles.muted}>Placed {formatDateTime(o.date)}{o.pincode ? ` · ${o.pincode}` : ''}</Text>
      </Card>

      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      {actions()}

      <Card title="Progress">
        <Tracker steps={trackerSteps({ ...o, executive: executive ? { name: executive.name } : null })} />
      </Card>

      <Card title="Customer">
        <InfoRow label="Name" value={o.user?.name} />
        <InfoRow label="Phone" value={phone ? displayPhone(phone) : null} />
        <InfoRow label="Email" value={o.user?.email} />
        <InfoRow label="Address" value={o.address} />
        {phone ? <Button title="Call customer" variant="secondary" onPress={() => void Linking.openURL(telHref(phone))} /> : null}
      </Card>

      <Card title="Assignment">
        <InfoRow label="Partner" value={partner ? partner.name : o.partnerId ? '(another partner)' : 'Not routed yet'} />
        <InfoRow label="Executive" value={executive ? `${executive.name} · ${displayPhone(executive.phone)}` : o.riderId ? '(another team)' : 'None yet'} />
        <InfoRow label="Hub" value={o.hubStatus === 'handed_over' ? `Received${o.hubReceivedBy ? ` by ${o.hubReceivedBy}` : ''}` : isCompleted(status) ? 'Waiting for receipt' : '—'} />
      </Card>

      <Card title="Payment">
        <InfoRow label={payout.paid ? 'Paid' : 'Due'} value={`${formatInr(payout.amount)} by ${payout.methodLabel}`} />
        {payout.paid ? <InfoRow label="Paid by / reference" value={[payout.paidBy, payout.reference].filter(Boolean).join(' · ')} /> : null}
        {payout.method === 'upi' && typeof answers.upiId === 'string' ? <InfoRow label="UPI ID" value={answers.upiId} /> : null}
        {payout.method === 'bank_transfer' ? (
          <InfoRow label="Bank" value={[answers.bankAccountName, answers.bankAccount, answers.bankIfsc].filter(v => typeof v === 'string').join(' · ')} />
        ) : null}
      </Card>

      {o.riderAnswers || o.verificationImages.length ? (
        <Card title="Executive's check">
          {typeof riderAnswers.notes === 'string' && riderAnswers.notes ? <InfoRow label="Notes" value={riderAnswers.notes} /> : null}
          {typeof riderAnswers.imei === 'string' && riderAnswers.imei ? <InfoRow label="IMEI" value={[riderAnswers.imei, riderAnswers.imei2].filter(Boolean).join(' / ')} /> : null}
          {o.offeredPrice !== null ? <InfoRow label="Offered price" value={formatInr(o.offeredPrice)} /> : null}
          <View style={styles.photos}>
            {o.verificationImages.map(src => <Image key={src} source={{ uri: imageUrl(src) ?? undefined }} style={styles.photo} />)}
          </View>
        </Card>
      ) : null}

      <ListPicker
        visible={picker === 'rider'}
        title="Assign a field executive"
        items={riders}
        keyOf={r => r.id}
        labelOf={r => r.name}
        detailOf={r => [displayPhone(r.phone), r.partner?.name, r.status].filter(Boolean).join(' · ')}
        onClose={() => setPicker(null)}
        onPick={r => { setPicker(null); void run(`${r.name} assigned.`, () => staffOrdersApi.assignRider(o.id, r.id)); }}
      />
      <ListPicker
        visible={picker === 'partner'}
        title="Route to a partner"
        items={partners.filter(p => p.routable)}
        keyOf={p => p.id}
        labelOf={p => p.name}
        detailOf={p => (p.pincodes.length ? `Pincodes ${p.pincodes.join(', ')}` : 'No pincodes')}
        onClose={() => setPicker(null)}
        onPick={p => { setPicker(null); void run(`Routed to ${p.name}.`, () => staffOrdersApi.assignPartner(o.id, p.id)); }}
      />
      <TextPrompt visible={prompt === 'approveOther'} title="Approve at another price" label="Price (₹)" keyboardType="number-pad"
        confirmLabel="Approve" required onClose={() => setPrompt(null)}
        onSubmit={value => { setPrompt(null); void act(`Approved at ₹${value}.`, { action: 'approve_verification', overridePrice: value }); }} />
      <TextPrompt visible={prompt === 'reject'} title="Reject the revised price" message="The executive checks the device again." label="Reason"
        confirmLabel="Reject" onClose={() => setPrompt(null)}
        onSubmit={reason => { setPrompt(null); void act('Revised price rejected.', { action: 'reject_verification', reason }); }} />
      <TextPrompt visible={prompt === 'fail'} title="Mark as failed" label="Reason" confirmLabel="Mark failed" required onClose={() => setPrompt(null)}
        onSubmit={reason => { setPrompt(null); void act('Marked as failed.', { action: 'fail_order', reason }); }} />
      <TextPrompt visible={prompt === 'paid'} title="Customer paid" message="Transaction or gift-card order ID (never the gift card code)."
        label="Reference" confirmLabel="Mark paid" onClose={() => setPrompt(null)}
        onSubmit={reference => { setPrompt(null); void act('Payment recorded.', { action: 'mark_payout_paid', reference }); }} />
    </ScrollView>
  );

  function actions() {
    const buttons: ReactElement[] = [];
    if (status === ORDER_STATUS.PRICE_REVIEW && can.approvePrice) {
      const offered = review?.requestedPrice ?? o!.offeredPrice ?? o!.price;
      buttons.push(<Button key="approve" title={`Approve ${formatInr(offered)}`} loading={busy}
        onPress={() => void act(`Approved at ${formatInr(offered)}.`, { action: 'approve_verification' })} />);
      buttons.push(<Button key="other" title="Approve at another price" variant="secondary" onPress={() => setPrompt('approveOther')} />);
      buttons.push(<Button key="reject" title="Reject" variant="secondary" onPress={() => setPrompt('reject')} />);
    }
    if (isAssignable(status) && can.assignRider) {
      buttons.push(<Button key="rider" title={o!.riderId ? 'Change executive' : 'Assign executive'} loading={busy} onPress={() => setPicker('rider')} />);
    }
    if (isAssignable(status) && can.assignPartner) {
      buttons.push(<Button key="partner" title={o!.partnerId ? 'Re-route to another partner' : 'Route to a partner'} variant="secondary" onPress={() => setPicker('partner')} />);
    }
    if (can.manage && isCompleted(status)) {
      buttons.push(o!.hubStatus === 'handed_over'
        ? <Button key="hub" title="Undo hub receipt" variant="secondary" loading={busy} onPress={() => void act('Hub receipt undone.', { action: 'update_hub_status', hubStatus: 'pending' })} />
        : <Button key="hub" title="Received at hub" loading={busy} onPress={() => void act('Received at the hub.', { action: 'update_hub_status', hubStatus: 'handed_over' })} />);
    }
    if (can.manage && (status === ORDER_STATUS.PICKED_UP || isCompleted(status)) && !payout.paid) {
      buttons.push(<Button key="paid" title={`Mark ${formatInr(payout.amount)} paid`} variant="secondary" onPress={() => setPrompt('paid')} />);
    }
    if (can.manage && isFailed(status)) {
      buttons.push(<Button key="restore" title="Restore order" variant="secondary" loading={busy} onPress={() => void act('Order restored.', { action: 'restore_order' })} />);
    }
    if (can.manage && !isFailed(status) && !isCompleted(status)) {
      buttons.push(<Button key="fail" title="Mark as failed" variant="link" onPress={() => setPrompt('fail')} />);
    }
    if (can.delete) buttons.push(<Button key="delete" title="Delete order" variant="link" onPress={confirmDelete} />);
    return buttons.length ? <View style={styles.actions}>{buttons}</View> : null;
  }
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg, maxWidth: 720, width: '100%', alignSelf: 'center' },
  device: { fontSize: font.heading, fontWeight: '800', color: colors.navy },
  price: { fontSize: 28, fontWeight: '800', color: colors.green },
  muted: { fontSize: font.small, color: colors.muted },
  actions: { gap: spacing.sm },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { width: 88, height: 88, borderRadius: 8, backgroundColor: colors.placeholder },
});
