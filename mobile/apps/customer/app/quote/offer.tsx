import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useOfferPrice, usePincodeAvailability, useQuestionnaire, useSession } from '@fonzkart/api';
import { cleanPincode, describeAnswers, formatInr, isCompletePincode, stepsForDevice } from '@fonzkart/core';
import { Button, EmptyState, ErrorState, Loading, Notice, RemoteImage, TextField, colors, font, radius, spacing } from '@fonzkart/ui';
import { PAGE_PADDING } from '../../src/grid';
import { useQuoteDraft } from '../../src/quoteDraft';

export default function Offer() {
  const router = useRouter();
  const draft = useQuoteDraft();
  const { session } = useSession();
  const questionnaire = useQuestionnaire();
  const price = useOfferPrice(draft?.basePrice, draft?.answers, draft?.category ?? 'smartphone');
  const [pincode, setPincode] = useState('');
  const pickup = usePincodeAvailability(pincode);
  const [bookingNote, setBookingNote] = useState(false);

  const summary = useMemo(() => {
    if (!draft?.answers || !questionnaire.data) return [];
    return describeAnswers(stepsForDevice(questionnaire.data, draft.category, draft.modelName), draft.answers);
  }, [draft, questionnaire.data]);

  if (!draft?.answers) return <EmptyState message="Choose a device and answer the questions first." />;

  const book = () => {
    if (session.status !== 'signedIn') {
      router.push({ pathname: '/account/sign-in', params: { returnTo: '/quote/offer' } });
    } else {
      setBookingNote(true);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.offer}>
        <RemoteImage uri={draft.img} label={draft.modelName} size={120} />
        <Text style={styles.device}>{draft.modelName}</Text>
        <Text style={styles.variant}>{draft.variantName}</Text>
        <Text style={styles.offerLabel}>Your final offer</Text>
        {price.isPending ? (
          <Loading label="Calculating your price…" />
        ) : price.isError || typeof price.data !== 'number' ? (
          <ErrorState message="Could not calculate the price. Check your internet connection." onRetry={() => price.refetch()} />
        ) : (
          <Text style={styles.price} accessibilityLabel={`Your final offer ${formatInr(price.data)}`}>{formatInr(price.data)}</Text>
        )}
        <Text style={styles.max}>Max value {formatInr(draft.basePrice)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Free doorstep pickup</Text>
        <TextField
          label="Your pincode"
          value={pincode}
          onChangeText={text => setPincode(cleanPincode(text))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="6-digit pincode"
        />
        {isCompletePincode(pincode) ? (
          pickup.isPending ? (
            <Text style={styles.checking}>Checking {pincode}…</Text>
          ) : pickup.isError ? (
            <Notice tone="error" text="Could not check this pincode. Try again in a moment." />
          ) : pickup.data ? (
            <Notice tone="success" text={`Pickup is available at ${pincode}.`} />
          ) : (
            <Notice tone="error" text={`We don't pick up from ${pincode} yet.`} />
          )
        ) : null}
        <Button title="Book free pickup" onPress={book} disabled={!pickup.data || !isCompletePincode(pincode)} />
        {session.status !== 'signedIn' ? <Text style={styles.small}>You'll sign in or create an account to book.</Text> : null}
        {bookingNote ? <Notice text="Pickup booking comes in the next app update. Your offer above is your price for this device." /> : null}
      </View>

      {summary.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your answers</Text>
          {summary.map(line => (
            <View key={line.title} style={styles.answer}>
              <Text style={styles.answerTitle}>{line.title}</Text>
              <Text style={styles.answerValue}>{line.value}</Text>
            </View>
          ))}
          <Button title="Change answers" variant="link" onPress={() => router.back()} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  offer: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.xs },
  device: { fontSize: font.heading, fontWeight: '800', color: colors.navy, marginTop: spacing.sm, textAlign: 'center' },
  variant: { fontSize: font.small, color: colors.muted },
  offerLabel: { fontSize: font.small, fontWeight: '700', color: colors.muted, marginTop: spacing.lg, textTransform: 'uppercase', letterSpacing: 0.5 },
  price: { fontSize: 40, fontWeight: '800', color: colors.green },
  max: { fontSize: font.small, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  cardTitle: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  checking: { fontSize: font.small, color: colors.muted },
  small: { fontSize: font.small, color: colors.muted, textAlign: 'center' },
  answer: { gap: 2 },
  answerTitle: { fontSize: font.small, color: colors.muted },
  answerValue: { fontSize: font.body, fontWeight: '600', color: colors.text },
});
