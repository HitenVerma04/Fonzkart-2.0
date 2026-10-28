import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { customerOrdersApi, usePincodeAvailability, useQuestionnaire, useQuote, useSession } from '@fonzkart/api';
import { cleanPincode, describeAnswers, formatInr, isCompletePincode, stepsForDevice } from '@fonzkart/core';
import { makeStyles, useColors } from '@fonzkart/ui';
import { networkMessage } from '../../src/authFlow';
import {
  Appear, Button, Card, EmptyState, ErrorState, Icon, LoadingDots, Notice, Page, ProductImage, radii, Skeleton,
  TextField, type, useDesign,
} from '../../src/design';
import { useQuoteDraft } from '../../src/quoteDraft';

export default function Offer() {
  const styles = useStyles();
  const colors = useColors();
  const d = useDesign();
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

  if (!draft?.answers) return <EmptyState icon="auto" message="Choose a device and answer the questions first." />;

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
    <Page>
      <Appear>
        <View style={[styles.offer, { boxShadow: d.shadow.md }]}>
          <View style={styles.imageWell}>
            <ProductImage uri={draft.img} label={draft.modelName} size={120} />
          </View>
          <Text style={styles.device}>{draft.modelName}</Text>
          <Text style={styles.variant}>{draft.variantName}</Text>
          <View style={[styles.priceBox, { backgroundImage: d.heroGradient }]}>
            <Text style={styles.offerLabel}>Your final offer</Text>
            {quote.isPending ? (
              <View style={styles.priceLoading} accessibilityLabel="Calculating your price">
                <Skeleton width={180} height={44} radius={radii.sm} />
                <LoadingDots color="#ffffff" />
              </View>
            ) : quote.isError || typeof quote.data?.price !== 'number' ? (
              <View style={styles.priceError}>
                <ErrorState message="Could not calculate the price. Check your internet connection." onRetry={() => quote.refetch()} />
              </View>
            ) : (
              <Animated.Text entering={ZoomIn.springify().damping(20).stiffness(180)} style={styles.price}
                accessibilityLabel={`Your final offer ${formatInr(quote.data.price)}`}>
                {formatInr(quote.data.price)}
              </Animated.Text>
            )}
            <Text style={styles.max}>Max value {formatInr(draft.basePrice)}</Text>
          </View>
        </View>
      </Appear>

      <Appear index={1}>
        <Card title="Free doorstep pickup" icon="truck">
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
              <View style={styles.checking}>
                <LoadingDots color={colors.green} size={6} />
                <Text style={styles.checkingText}>Checking {pincode}…</Text>
              </View>
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
                    <Button title="Notify me when you come here" variant="secondary" icon="bell" loading={request.sending}
                      disabled={requestPhone.length !== 10} onPress={() => void askForArea()} />
                    {request.error ? <Notice tone="error" text={request.error} /> : null}
                  </>
                )}
              </View>
            )
          ) : null}
          <Button title="Book free pickup" icon="truck" onPress={book}
            disabled={!pickup.data || !isCompletePincode(pincode) || typeof quote.data?.price !== 'number'} />
          {session.status !== 'signedIn' ? (
            <View style={styles.hint}>
              <Icon name="lock" color={colors.muted} size={14} />
              <Text style={styles.small}>You'll sign in or create an account to book.</Text>
            </View>
          ) : null}
        </Card>
      </Appear>

      {summary.length ? (
        <Appear index={2}>
          <Card
            title="Your answers"
            icon="check"
            right={<Button title="Edit" variant="secondary" size="sm" onPress={() => router.back()} />}
          >
            <Text style={styles.answersHint}>Your price is based on these answers. The executive confirms them at pickup.</Text>
            <View style={styles.answers}>
              {summary.map((line, i) => (
                <View key={line.title} style={[styles.answer, i > 0 && styles.answerDivider]}>
                  <View style={styles.answerMark}>
                    <Icon name="check" color={colors.green} size={12} strokeWidth={3} />
                  </View>
                  <Text style={styles.answerTitle}>{line.title}</Text>
                  <Text style={styles.answerValue}>{line.value}</Text>
                </View>
              ))}
            </View>
          </Card>
        </Appear>
      ) : null}
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  offer: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 4 },
  imageWell: { width: 150, height: 150, borderRadius: 75, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  device: { ...type.title, fontSize: 20, color: colors.navy, textAlign: 'center' },
  variant: { ...type.small, color: colors.muted },
  priceBox: { alignSelf: 'stretch', alignItems: 'center', borderRadius: radii.lg, paddingVertical: 18, paddingHorizontal: 12, marginTop: 14, gap: 4 },
  offerLabel: { ...type.tiny, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' },
  priceLoading: { alignItems: 'center', gap: 6, paddingVertical: 4 },
  priceError: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radii.md },
  price: { fontSize: 44, lineHeight: 52, fontWeight: '800', letterSpacing: -1, color: '#ffffff' },
  max: { ...type.small, color: 'rgba(255,255,255,0.8)' },
  checking: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkingText: { ...type.small, color: colors.muted },
  request: { gap: 12 },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  small: { ...type.small, color: colors.muted, textAlign: 'center' },
  answersHint: { ...type.small, color: colors.muted, marginTop: -4 },
  answers: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 14 },
  answer: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12 },
  answerDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  answerMark: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  answerTitle: { flex: 1, ...type.small, color: colors.muted },
  answerValue: { flex: 1.2, ...type.small, fontWeight: '700', color: colors.text, textAlign: 'right' },
}));
