// Booking a repair for one phone: what is wrong, when to visit, and where. The price shown is fixed; the server takes it
// from its own list, and the customer pays after the repair.
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  REPAIR_ISSUES, REPAIR_SLOTS, repairKeys, useBookRepair, useRepairPrices, useSession, type RepairBooking, type RepairSlot,
} from '@fonzkart/api';
import { formatInr } from '@fonzkart/core';
import { makeStyles } from '@fonzkart/ui';
import { networkMessage } from '../../src/authFlow';
import { Appear, Button, Card, ChoiceCard, Chip, EmptyState, ErrorState, Notice, Page, SkeletonCard, type } from '../../src/design';
import { DeliveryFields, useDeliveryForm } from '../../src/shop/DeliveryFields';

const DAYS_SHOWN = 7;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** The days a visit can be booked for, from tomorrow. */
function visitDays() {
  return Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() + i + 1);
    return {
      id: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`,
      label: i === 0 ? 'Tomorrow' : WEEKDAYS[day.getDay()]!,
      caption: `${day.getDate()} ${MONTHS[day.getMonth()]}`,
    };
  });
}

export default function BookRepair() {
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { brand, model } = useLocalSearchParams<{ brand: string; model: string }>();
  const { session } = useSession();
  const prices = useRepairPrices();
  const book = useBookRepair();
  const form = useDeliveryForm();
  const days = useMemo(visitDays, []);
  const [priceId, setPriceId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<RepairSlot | null>(null);
  const [error, setError] = useState('');

  if (prices.isPending) return <Page><SkeletonCard lines={4} /><SkeletonCard lines={3} /></Page>;
  if (prices.isError) return <ErrorState error={prices.error} onRetry={() => prices.refetch()} />;
  const options = REPAIR_ISSUES.flatMap(issue => {
    const price = prices.data.items.find(p => p.brand === brand && p.model === model && p.issue === issue.id);
    return price ? [{ ...issue, priceId: price.id, price: price.price }] : [];
  });
  if (!options.length) {
    return (
      <EmptyState icon="repair" title="We don't repair this phone yet" message="See every phone we repair."
        action={{ label: 'Back to repairs', onPress: () => router.navigate('/repair') }} />
    );
  }
  const chosen = options.find(o => o.priceId === priceId);
  const signedIn = session.status === 'signedIn';
  const problem = !chosen ? 'Choose what needs repairing.' : !date ? 'Choose a day for the visit.' : !slot ? 'Choose a time.' : signedIn ? form.problem : '';

  const confirm = async () => {
    if (!chosen || !date || !slot) return;
    setError('');
    try {
      const booking = await book.mutateAsync({ repairPriceId: chosen.priceId, visitDate: date, slot, ...form.values });
      queryClient.setQueryData<RepairBooking[]>(repairKeys.myBookings, old => [booking, ...(old ?? []).filter(b => b.id !== booking.id)]);
      router.dismissTo('/repair');
      router.push({ pathname: '/repairs/booking/[id]', params: { id: booking.id, placed: '1' } });
    } catch (e) {
      setError(networkMessage(e));
    }
  };

  return (
    <Page>
      <Appear>
        <Text style={styles.model}>{model}</Text>
        <Text style={styles.small}>{brand}</Text>
      </Appear>
      <Appear index={1}>
        <Card title="What needs repairing?" icon="repair">
          {options.map(o => (
            <ChoiceCard key={o.id} label={`${o.label} · ${formatInr(o.price)}`} description={o.detail} selected={priceId === o.priceId} onPress={() => setPriceId(o.priceId)} />
          ))}
        </Card>
      </Appear>
      <Appear index={2}>
        <Card title="When should we come?" icon="clock">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {days.map(d => <Chip key={d.id} label={d.label} caption={d.caption} selected={date === d.id} role="radio" onPress={() => setDate(d.id)} />)}
          </ScrollView>
          <View style={styles.slots}>
            {REPAIR_SLOTS.map(s => <Chip key={s.id} label={s.label} caption={s.time} wide selected={slot === s.id} role="radio" onPress={() => setSlot(s.id)} />)}
          </View>
        </Card>
      </Appear>
      {signedIn ? (
        <Appear index={3}>
          <Card title="Where should we come?" icon="location">
            <DeliveryFields form={form} phoneHint="The technician calls this number." />
          </Card>
        </Appear>
      ) : null}
      <Appear index={4} style={styles.footer}>
        {chosen ? (
          <View style={styles.row}>
            <Text style={styles.total}>Pay after the repair</Text>
            <Text style={styles.total}>{formatInr(chosen.price)}</Text>
          </View>
        ) : null}
        {problem && !error ? <Notice text={problem} /> : null}
        {error ? <Notice tone="error" text={error} /> : null}
        {signedIn ? (
          <Button title="Book the visit" icon="check" loading={book.isPending} disabled={!!problem} onPress={() => void confirm()} />
        ) : (
          <Button title="Sign in to book" icon="user" onPress={() => router.push({ pathname: '/account/sign-in', params: { returnTo: `/repairs/book?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}` } })} />
        )}
      </Appear>
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  model: { ...type.title, color: colors.navy },
  small: { ...type.small, color: colors.muted },
  chips: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  slots: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  total: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.navy },
  footer: { gap: 12 },
}));
