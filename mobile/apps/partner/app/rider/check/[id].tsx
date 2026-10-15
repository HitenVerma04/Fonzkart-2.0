// The executive's device check at pickup (the website's VerificationModal): the customer's answers re-checked with the
// same questionnaire, photos, IMEI, and the price the server gives for the checked answers. The quoted price
// stands: picked up. A different price: it waits for the partner's or Fonzkart's approval before the device is taken.
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { executiveApi, executiveKeys, uploadImage, useExecutiveOrder, useQuestionnaire, useQuote } from '@fonzkart/api';
import { formatInr, imageUrl, parseAnswers, splitDevice, stepsForDevice, type Answers } from '@fonzkart/core';
import { Button, Card, EmptyState, ErrorState, Loading, Notice, QuestionStepView, TextField, colors, font, radius, spacing } from '@fonzkart/ui';
import { ImeiScanner } from '../../../src/ImeiScanner';

const MAX_PHOTOS = 6;

export default function DeviceCheck() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const order = useExecutiveOrder(id);
  const questionnaire = useQuestionnaire();
  const device = order.data ? splitDevice(order.data.device) : null;
  const [answers, setAnswers] = useState<Answers | null>(null);
  const current = answers ?? (order.data ? (parseAnswers(order.data.answers) as Answers) : undefined);
  const quote = useQuote(device?.model, device?.variant, current);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imei, setImei] = useState('');
  const [imei2, setImei2] = useState('');
  const [scanning, setScanning] = useState<'imei' | 'imei2' | null>(null);
  const [notes, setNotes] = useState('');
  const [offer, setOffer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const steps = useMemo(
    () => (questionnaire.data && device && quote.data ? stepsForDevice(questionnaire.data, quote.data.category, device.model) : []),
    [questionnaire.data, device, quote.data],
  );

  if (order.isPending || questionnaire.isPending) return <Loading />;
  if (order.isError || questionnaire.isError) return <ErrorState onRetry={() => { void order.refetch(); void questionnaire.refetch(); }} />;
  if (!device) return <EmptyState message="This device can't be checked in the app. Use the website." />;

  const o = order.data;
  const computed = quote.data?.price;
  const offered = offer !== null ? Number(offer.replace(/\D/g, '')) : computed;
  const set = (key: string, value: Answers[string]) => setAnswers(prev => ({ ...(prev ?? (parseAnswers(o.answers) as Answers)), [key]: value }));

  const addPhoto = async (fromCamera: boolean) => {
    setError('');
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow camera access in settings to take photos.');
      return;
    }
    const options = { mediaTypes: ['images'] as ImagePicker.MediaType[], quality: 0.6 };
    const result = fromCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setUploading(true);
    try {
      const url = await uploadImage({ uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' });
      setPhotos(prev => [...prev, url]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The photo could not be uploaded.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (declined: boolean) => {
    setBusy(true);
    setError('');
    try {
      await executiveApi.submitVerification(o.id, {
        status: declined ? 'failed' : undefined,
        offeredPrice: offered ?? o.price,
        verificationImages: photos,
        riderAnswers: { notes, imei, imei2, verifiedAt: new Date().toISOString(), answers: current },
      });
      await client.invalidateQueries({ queryKey: executiveKeys.orders });
      // Back to the pickup: it now shows the next step (pay and deliver, or wait for the price approval).
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the check. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const changed = typeof offered === 'number' && offered !== o.price;

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Card title={o.device}>
        <Text style={styles.muted}>Quoted to the customer: {formatInr(o.price)}</Text>
        <Text style={styles.muted}>Go through the customer's answers with the device in hand and correct what differs.</Text>
      </Card>

      {steps.map(step => (
        <Card key={step.id}>
          <QuestionStepView step={step} answers={current ?? {}} onChange={set} />
        </Card>
      ))}

      <Card title={`Photos (${photos.length}/${MAX_PHOTOS})`}>
        <View style={styles.photos}>
          {photos.map(src => (
            <Pressable key={src} onLongPress={() => setPhotos(prev => prev.filter(p => p !== src))} accessibilityLabel="Photo; long-press to remove">
              <Image source={{ uri: imageUrl(src) ?? undefined }} style={styles.photo} />
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <View style={styles.flex}><Button title="Take photo" variant="secondary" loading={uploading} disabled={photos.length >= MAX_PHOTOS} onPress={() => void addPhoto(true)} /></View>
          <View style={styles.flex}><Button title="From gallery" variant="secondary" disabled={uploading || photos.length >= MAX_PHOTOS} onPress={() => void addPhoto(false)} /></View>
        </View>
        <Text style={styles.muted}>Front, back, screen on, and any damage. Long-press a photo to remove it.</Text>
      </Card>

      <Card title="IMEI">
        <TextField label="IMEI 1" value={imei} onChangeText={t => setImei(t.replace(/\D/g, '').slice(0, 15))} keyboardType="number-pad"
          hint="Dial *#06# on the phone, or scan the box label." />
        <Button title="Scan IMEI 1" variant="link" onPress={() => setScanning('imei')} />
        <TextField label="IMEI 2 (dual SIM)" value={imei2} onChangeText={t => setImei2(t.replace(/\D/g, '').slice(0, 15))} keyboardType="number-pad" />
        <Button title="Scan IMEI 2" variant="link" onPress={() => setScanning('imei2')} />
      </Card>

      <Card title="Price">
        {quote.isPending ? <Loading label="Calculating…" /> : null}
        {typeof computed === 'number' ? <Text style={styles.muted}>Price for the checked answers: {formatInr(computed)}</Text> : null}
        <TextField label="Your offer (₹)" value={offer ?? (computed !== undefined ? String(computed) : '')}
          onChangeText={setOffer} keyboardType="number-pad" />
        {changed ? (
          <Notice text={`${formatInr(offered!)} differs from the quote. It goes to your partner for approval; don't take the device until it is approved.`} />
        ) : (
          <Notice tone="success" text="Same as the quote: confirming picks the device up. Pay the customer next." />
        )}
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="What you found" />
      </Card>

      {error ? <Notice tone="error" text={error} /> : null}
      <Button title={changed ? 'Send revised price for approval' : 'Confirm pickup'} loading={busy}
        disabled={uploading || typeof offered !== 'number' || Number.isNaN(offered)} onPress={() => void submit(false)} />
      <Button title="Customer declined / device not accepted" variant="link" disabled={busy} onPress={() => void submit(true)} />

      <ImeiScanner
        visible={scanning !== null}
        onClose={() => setScanning(null)}
        onScanned={code => {
          if (scanning === 'imei2') setImei2(code);
          else setImei(code);
          setScanning(null);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg, maxWidth: 720, width: '100%', alignSelf: 'center' },
  muted: { fontSize: font.small, color: colors.muted },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { width: 88, height: 88, borderRadius: radius.sm, backgroundColor: colors.placeholder },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
