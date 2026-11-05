// A repair booking: the confirmation right after booking, and its details from My orders.
import { RefreshControl, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { REPAIR_ISSUES, REPAIR_SLOTS, useMyRepairBookings } from '@fonzkart/api';
import { formatInr } from '@fonzkart/core';
import { formatDateTime, makeStyles, useColors } from '@fonzkart/ui';
import { Appear, Card, EmptyState, ErrorState, InfoRow, Notice, Page, radii, SkeletonCard, type, useDesign } from '../../../src/design';
import { RepairStatusBadge } from '../../../src/shop/ShopBits';
import { visitDay } from '../../../src/shop/visitDay';

export default function RepairBookingDetail() {
  const styles = useStyles();
  const colors = useColors();
  const d = useDesign();
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const bookings = useMyRepairBookings(true);

  if (bookings.isPending) return <Page><SkeletonCard lines={2} tall /><SkeletonCard lines={4} /></Page>;
  if (bookings.isError) return <ErrorState message="Could not load this booking." error={bookings.error} onRetry={() => bookings.refetch()} />;
  const b = bookings.data.find(x => x.id === id);
  if (!b) return <EmptyState icon="repair" title="Booking not found" message="This booking is not on your account." />;
  const issue = REPAIR_ISSUES.find(i => i.id === b.issue)?.label ?? b.issue;
  const slot = REPAIR_SLOTS.find(s => s.id === b.slot);

  return (
    <Page refreshControl={<RefreshControl refreshing={bookings.isRefetching} onRefresh={() => void bookings.refetch()} colors={[colors.green]} tintColor={colors.green} />}>
      {placed ? <Appear><Notice tone="success" text={`Repair booked! Booking #${b.bookingNumber}. We'll call you to confirm the visit.`} /></Appear> : null}
      <Appear index={1}>
        <View style={[styles.summary, { boxShadow: d.shadow.md }]}>
          <View style={styles.top}>
            <Text style={styles.number}>Booking #{b.bookingNumber}</Text>
            <RepairStatusBadge status={b.status} />
          </View>
          <Text style={styles.date}>{formatDateTime(b.createdAt)}</Text>
          <Text style={styles.name}>{issue}</Text>
          <Text style={styles.date}>{b.model}</Text>
          <Text style={styles.label}>Pay after the repair</Text>
          <Text style={styles.price}>{formatInr(b.price)}</Text>
        </View>
      </Appear>
      <Appear index={2}>
        <Card title="Visit" icon="clock">
          <InfoRow icon="clock" label="When" value={`${visitDay(b.visitDate)}, ${slot ? `${slot.label.toLowerCase()} (${slot.time})` : b.slot}`} />
          <InfoRow icon="user" label="Name" value={b.name} />
          <InfoRow icon="phone" label="Mobile" value={`+91 ${b.phone}`} />
          <InfoRow icon="location" label="Address" value={`${b.address}, ${b.pincode}`} />
        </Card>
      </Appear>
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  summary: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  number: { ...type.heading, fontSize: 18, color: colors.navy },
  date: { ...type.small, color: colors.muted },
  name: { ...type.label, fontSize: 16, color: colors.text, marginTop: 10 },
  label: { ...type.small, fontWeight: '600', color: colors.muted, marginTop: 10 },
  price: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4, color: colors.navy },
}));
