// Pickup booking: the website's booking steps (address, time, payment) on one screen. The order is placed on the
// same backend as the website, at the server's price for the device and answers (the offer the customer saw).
import { useEffect, useMemo, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { usePincodeAvailability, usePlaceOrder, useProfile, useQuote, useSession } from '@fonzkart/api';
import {
  PAYMENT_METHODS, availableSlots, bookingAnswers, bookingProblems, cleanPincode, expressAvailable, formatInr,
  isCompletePincode, pickupDays, type PaymentMethod,
} from '@fonzkart/core';
import { makeStyles, useColors } from '@fonzkart/ui';
import { networkMessage } from '../src/authFlow';
import {
  Appear, Button, Card, ChoiceCard, Chip, EmptyState, Icon, LoadingDots, Notice, Page, ProductImage, radii, TextField,
  type, useDesign,
} from '../src/design';
import { useQuoteDraft } from '../src/quoteDraft';

export default function Book() {
  const colors = useColors();
  const d = useDesign();
  const styles = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ pincode?: string }>();
  const draft = useQuoteDraft();
  const { session } = useSession();
  const profile = useProfile(session.status === 'signedIn');
  const quote = useQuote(draft?.modelName, draft?.variantName, draft?.answers);
  const placeOrder = usePlaceOrder();

  const [now] = useState(() => new Date());
  const days = useMemo(() => pickupDays(now), [now]);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState(cleanPincode(params.pincode ?? ''));
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [detectedAddress, setDetectedAddress] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [dayIndex, setDayIndex] = useState(0);
  const [slot, setSlot] = useState('');
  const [isExpress, setIsExpress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [error, setError] = useState('');
  const pickup = usePincodeAvailability(pincode);

  // The account's phone number (stored as +91XXXXXXXXXX) as the default contact number.
  useEffect(() => {
    const stored = profile.data?.phone?.replace(/\D/g, '').slice(-10);
    if (stored && !phone) setPhone(stored);
  }, [profile.data, phone]);

  const day = days[dayIndex];
  const slots = availableSlots(day, now);
  const express = expressAvailable(now) && !!day?.isToday;
  useEffect(() => {
    if (slot && !slots.includes(slot)) setSlot('');
  }, [slot, slots]);

  if (!draft?.answers) return <EmptyState icon="auto" message="Choose a device and answer the questions first." />;
  if (session.status !== 'signedIn') return <EmptyState icon="lock" message="Sign in to book a pickup." />;

  const details = {
    phone, address, pincode, location, detectedAddress, day, slot, isExpress: isExpress && express, paymentMethod,
    upiId, bankAccount, bankIfsc, bankAccountName,
  };
  const problems = bookingProblems(details);
  const serviceable = isCompletePincode(pincode) && pickup.data === true;

  const locateMe = async () => {
    setLocating(true);
    setLocationError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationError('Location permission was not given. You can type your address instead.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      setLocation(coords);
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
        if (place) {
          const text = place.formattedAddress
            ?? [place.name, place.street, place.district, place.city, place.region, place.postalCode].filter(Boolean).join(', ');
          setDetectedAddress(text);
          if (!address.trim()) setAddress(text);
          if (!pincode && place.postalCode) setPincode(cleanPincode(place.postalCode));
        }
      } catch {
        // No address lookup here (e.g. in a browser): the pin location is still sent with the order.
      }
    } catch {
      setLocationError('Could not get your location. Check that location is turned on, or type your address.');
    } finally {
      setLocating(false);
    }
  };

  const confirm = async () => {
    setError('');
    try {
      const placed = await placeOrder.mutateAsync({
        device: draft.modelName,
        variant: draft.variantName,
        address: address.trim() || detectedAddress,
        pincode,
        location,
        answers: bookingAnswers(draft.answers ?? {}, details),
      });
      router.dismissAll();
      router.push({ pathname: '/orders/[id]', params: { id: placed.id, placed: '1' } });
    } catch (e) {
      setError(networkMessage(e));
    }
  };

  return (
    <Page>
      <Appear>
        <View style={[styles.summary, { backgroundImage: d.heroGradient, boxShadow: d.shadow.green }]}>
          <View style={styles.summaryImage}>
            <ProductImage uri={draft.img} label={draft.modelName} size={44} />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.device} numberOfLines={2}>{draft.modelName}</Text>
            <Text style={styles.variant}>{draft.variantName}</Text>
          </View>
          {typeof quote.data?.price === 'number' ? (
            <Text style={styles.price}>{formatInr(quote.data.price)}</Text>
          ) : (
            <LoadingDots color="#ffffff" size={6} />
          )}
        </View>
      </Appear>

      <Appear index={1}>
        <Card title="Pickup address" icon="location">
          <Button title={locating ? 'Finding you…' : 'Use my current location'} variant="secondary" icon="location" loading={locating}
            onPress={() => void locateMe()} />
          {location ? <Notice tone="success" text="Location pinned. The executive will navigate to it." /> : null}
          {locationError ? <Notice tone="error" text={locationError} /> : null}
          <TextField label="House / flat, street, area" value={address} onChangeText={setAddress} multiline
            placeholder="e.g. 12, 2nd Cross, Indiranagar" />
          <TextField label="Pincode" value={pincode} onChangeText={text => setPincode(cleanPincode(text))}
            keyboardType="number-pad" maxLength={6} />
          {isCompletePincode(pincode) && pickup.data === false ? (
            <Notice tone="error" text={`We don't pick up from ${pincode} yet.`} />
          ) : null}
          <TextField label="Mobile number" value={phone} onChangeText={text => setPhone(text.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad" prefix="+91" hint="The executive calls this number before coming." />
        </Card>
      </Appear>

      <Appear index={2}>
        <Card title="Pickup time" icon="clock">
          <View style={styles.chips}>
            {days.map(dd => (
              <Chip key={dd.index} selected={dd.index === dayIndex} onPress={() => setDayIndex(dd.index)}
                label={dd.isToday ? 'Today' : dd.weekday} caption={String(dd.date)} />
            ))}
          </View>
          {slots.length ? (
            <View style={styles.chips}>
              {slots.map(s => (
                <Chip key={s} wide selected={!isExpress && s === slot} onPress={() => { setSlot(s); setIsExpress(false); }} label={s} />
              ))}
            </View>
          ) : (
            <Notice text="No slots left today. Choose another day." />
          )}
          <View style={[styles.express, !express && styles.disabled]}>
            <View style={styles.expressIcon}>
              <Icon name="bolt" color={colors.green} size={20} filled />
            </View>
            <View style={styles.expressText}>
              <Text style={styles.expressTitle}>Express pickup</Text>
              <Text style={styles.small}>{express ? 'Within a few hours today. Free.' : 'Available today between 10 AM and 4 PM.'}</Text>
            </View>
            <Switch value={isExpress && express} disabled={!express} onValueChange={value => { setIsExpress(value); if (value) setSlot(''); }}
              trackColor={{ true: colors.green, false: colors.track }} thumbColor="#ffffff" accessibilityLabel="Express pickup" />
          </View>
        </Card>
      </Appear>

      <Appear index={3}>
        <Card title="How would you like to be paid?" icon="wallet">
          {PAYMENT_METHODS.map(m => (
            <ChoiceCard key={m.id} label={m.label} description={m.detail} selected={paymentMethod === m.id}
              onPress={() => setPaymentMethod(m.id)} />
          ))}
          {paymentMethod === 'upi' ? (
            <TextField label="UPI ID" value={upiId} onChangeText={setUpiId} autoCapitalize="none" placeholder="name@bank" />
          ) : null}
          {paymentMethod === 'bank_transfer' ? (
            <>
              <TextField label="Account holder name" value={bankAccountName} onChangeText={setBankAccountName} />
              <TextField label="Account number" value={bankAccount} onChangeText={text => setBankAccount(text.replace(/\D/g, ''))}
                keyboardType="number-pad" />
              <TextField label="IFSC" value={bankIfsc} onChangeText={text => setBankIfsc(text.toUpperCase())} autoCapitalize="characters" />
            </>
          ) : null}
        </Card>
      </Appear>

      <Appear index={4} style={styles.footer}>
        {problems.length && !error ? <Notice text={problems[0]!} /> : null}
        {error ? <Notice tone="error" text={error} /> : null}
        <Button title="Confirm pickup" icon="check" loading={placeOrder.isPending}
          disabled={problems.length > 0 || !serviceable || typeof quote.data?.price !== 'number'}
          onPress={() => void confirm()} />
        <Text style={styles.small}>The executive checks the device at pickup. If its condition differs from your answers, they may offer a revised price for your approval.</Text>
      </Appear>
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radii.lg, padding: 14 },
  summaryImage: { width: 52, height: 52, borderRadius: radii.sm, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  summaryText: { flex: 1, gap: 2 },
  device: { ...type.label, fontSize: 15, color: '#ffffff' },
  variant: { ...type.small, color: 'rgba(255,255,255,0.8)' },
  price: { ...type.title, fontSize: 22, color: '#ffffff' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  express: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.greenBorder, backgroundColor: colors.greenSoft, borderRadius: radii.md, padding: 12 },
  expressIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.55 },
  expressText: { flex: 1, gap: 2 },
  expressTitle: { ...type.label, fontSize: 15, color: colors.text },
  small: { ...type.small, color: colors.muted },
  footer: { gap: 12 },
}));
