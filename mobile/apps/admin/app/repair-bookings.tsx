// Repair bookings from the Customer app, newest first: the phone, the repair, the visit and the customer. Staff confirm
// each visit, then complete or cancel it; the customer sees the status in the app.
import { useState } from 'react';
import { Alert, FlatList, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  REPAIR_ISSUES, REPAIR_SLOTS, REPAIR_STATUSES, repairAdminApi, repairKeys, useRepairAdminBookings, type RepairBooking, type RepairStatus,
} from '@fonzkart/api';
import { formatInr } from '@fonzkart/core';
import { EmptyState, ErrorState, Loading, Notice, Segmented, colors, font, formatDateTime, radius, spacing } from '@fonzkart/ui';

const statusLabel = (id: string) => REPAIR_STATUSES.find(s => s.id === id)?.label ?? id;
const issueLabel = (id: string) => REPAIR_ISSUES.find(i => i.id === id)?.label ?? id;
const slotLabel = (id: string) => REPAIR_SLOTS.find(s => s.id === id)?.time ?? id;

export default function RepairBookings() {
  const client = useQueryClient();
  const bookings = useRepairAdminBookings();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (bookings.isPending) return <Loading />;
  if (bookings.isError) return <ErrorState onRetry={() => bookings.refetch()} />;

  const apply = async (b: RepairBooking, status: RepairStatus) => {
    setBusy(b.id);
    setMessage(null);
    try {
      const r = await repairAdminApi.setStatus(b.id, status);
      if (r.error) setMessage({ tone: 'error', text: r.error });
      else {
        setMessage({ tone: 'success', text: `Booking #${b.bookingNumber} is now ${statusLabel(status).toLowerCase()}.` });
        await client.invalidateQueries({ queryKey: repairKeys.adminBookings });
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not update the booking.' });
    } finally {
      setBusy(null);
    }
  };

  const change = (b: RepairBooking, status: RepairStatus) => {
    if (status === b.status) return;
    if (status !== 'cancelled') {
      void apply(b, status);
      return;
    }
    const text = `Cancel booking #${b.bookingNumber} for ${b.name}? The customer sees it as cancelled.`;
    if (Platform.OS === 'web') {
      if ((globalThis as { confirm?: (t: string) => boolean }).confirm?.(text)) void apply(b, status);
      return;
    }
    Alert.alert('Cancel this booking?', text, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: () => void apply(b, status) },
    ]);
  };

  return (
    <FlatList
      data={bookings.data}
      keyExtractor={b => b.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={bookings.isRefetching} onRefresh={() => void bookings.refetch()} />}
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={styles.muted}>Doorstep repairs booked in the Customer app, newest first. The customer pays after the repair.</Text>
          {message ? <Notice tone={message.tone} text={message.text} /> : null}
        </View>
      }
      ListEmptyComponent={<EmptyState message="No repair bookings yet." />}
      renderItem={({ item: b }) => (
        <View style={[styles.order, b.status === 'cancelled' && styles.cancelled]}>
          <View style={styles.top}>
            <Text style={styles.number}>Booking #{b.bookingNumber}</Text>
            <Text style={styles.muted}>{formatDateTime(b.createdAt)}</Text>
          </View>
          <Text style={styles.name}>{b.name}</Text>
          <Text style={styles.muted} selectable>{b.phone}{b.customerEmail ? ` · ${b.customerEmail}` : ''}</Text>
          <View style={styles.itemRow}>
            <Text style={styles.itemName} numberOfLines={2}>{issueLabel(b.issue)} · {b.model}</Text>
            <Text style={styles.total}>{formatInr(b.price)}</Text>
          </View>
          <Text style={styles.label}>Visit: {b.visitDate}, {slotLabel(b.slot)}</Text>
          <Text style={styles.muted} selectable>{b.address}, {b.pincode}</Text>
          <Segmented options={REPAIR_STATUSES} value={b.status} onChange={s => (busy ? undefined : change(b, s))} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.md, marginBottom: spacing.xs },
  order: { gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  cancelled: { opacity: 0.6 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { fontSize: font.small, fontWeight: '800', color: colors.green },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  label: { fontSize: font.small, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.small, color: colors.muted },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xs },
  itemName: { flex: 1, fontSize: font.small, color: colors.text },
  total: { fontSize: font.heading, fontWeight: '800', color: colors.green },
});
