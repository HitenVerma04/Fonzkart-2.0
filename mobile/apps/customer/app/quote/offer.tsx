import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { customerOrdersApi, usePincodeAvailability, useQuestionnaire, useQuote, useSession } from '@fonzkart/api';
import { cleanPincode, describeAnswers, formatInr, isCompletePincode, stepsForDevice } from '@fonzkart/core';
import { Button, EmptyState, ErrorState, Loading, Notice, RemoteImage, TextField, colors, font, radius, spacing } from '@fonzkart/ui';
import { networkMessage } from '../../src/authFlow';
import { PAGE_PADDING } from '../../src/grid';
import { useQuoteDraft } from '../../src/quoteDraft';

export default function Offer() {
  const router = useRouter();
  const draft = useQuoteDraft();
  const { session } = useSession();
  const questionnaire = useQuestionnaire();
  // The server's price for this device and these answers: exactly what the order will be booked at.
  const quote = useQuote(draft?.modelName, draft?.variantName, draft?.answers);
  const [pincode, setPincode] = useState('');
  const pickup = usePincodeAvailability(pincode);
  const [requestPhone, setRequestPhone] = useState('');
  const [request, setRequest] = useState<{ sending: boolean; sent: boolean; error: string | null }>({ sending: false, sent: false, error: null });

  const summary = useMemo(() => {
    if (!draft?.answers || !questionnaire.data) return [];
    return describeAnswers(stepsForDevice(questionnaire.data, draft.category, draft.modelName), draft.answers);
  }, [draft, questionnaire.data]);

  if (!draft?.answers) return <EmptyState message="Choose a device and answer the questions first." />;

  const book = () => {
    if (session.status !== 'signedIn') {
      router.push({ pathname: '/account/sign-in', params: { returnTo: '/quote/offer' } });
    } else {
      router.push({ pathname: '/book', params: { pincode } });
    }
  };

  const askForArea = async () => {
    setRequest({ sending: true, sent: false, error: null });
    try {
      await customerOrdersApi.requestServiceArea(pincode, requestPhone, '');
      setRequest({ sending: false, sent: true, error: null });
    } catch (error) {
      setRequest({ sending: false, sent: false, error: networkMessage(error) });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.offer}>
        <RemoteImage uri={draft.img} label={draft.modelName} size={120} />
        <Text style={styles.device}>{draft.modelName}</Text>
        <Text style={styles.variant}>{draft.variantName}</Text>
        <Text style={styles.offerLabel}>Your final offer</Text>
        {quote.isPending ? (
          <Loading label="Calculating your price…" />
        ) : quote.isError || typeof quote.data?.price !== 'number' ? (
          <ErrorState message="Could not calculate the price. Check your internet connection." onRetry={() => quote.refetch()} />
        ) : (
          <Text style={styles.price} accessibilityLabel={`Your final offer ${formatInr(quote.data.price)}`}>{formatInr(quote.data.price)}</Text>
        )}
        <Text style={styles.max}>Max value {formatInr(draft.basePrice)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Free doorstep pickup</Text>
        <TextField
          label="Your pincode"
          value={pincode}
          onChangeText={text => {
            setPincode(cleanPincode(text));
            setRequest({ sending: false, sent: false, error: null });
          }}
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
            <View style={styles.request}>
              <Notice tone="error" text={`We don't pick up from ${pincode} yet.`} />
              {request.sent ? (
                <Notice tone="success" text="Thanks! We'll let you know when we start picking up in your area." />
              ) : (
                <>
                  <TextField
                    label="Your mobile number"
                    value={requestPhone}
                    onChangeText={text => setRequestPhone(text.replace(/\D/g, '').slice(0, 10))}
                    keyboardType="phone-pad"
                    prefix="+91"
                    placeholder="10-digit number"
                  />
                  <Button title="Notify me when you come here" variant="secondary" loading={request.sending}
                    disabled={requestPhone.length !== 10} onPress={() => void askForArea()} />
                  {request.error ? <Notice tone="error" text={request.error} /> : null}
                </>
              )}
            </View>
          )
        ) : null}
        <Button title="Book free pickup" onPress={book}
          disabled={!pickup.data || !isCompletePincode(pincode) || typeof quote.data?.price !== 'number'} />
        {session.status !== 'signedIn' ? <Text style={styles.small}>You'll sign in or create an account to book.</Text> : null}
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
  request: { gap: spacing.md },
  small: { fontSize: font.small, color: colors.muted, textAlign: 'center' },
  answer: { gap: 2 },
  answerTitle: { fontSize: font.small, color: colors.muted },
  answerValue: { fontSize: font.body, fontWeight: '600', color: colors.text },
});
