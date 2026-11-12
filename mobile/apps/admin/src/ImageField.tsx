// A catalog picture: a website path or URL typed in, or a photo uploaded from the phone (stored by the backend under
// /uploads, which the website serves too).
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@fonzkart/api';
import { Button, Notice, RemoteImage, TextField, colors, font, radius, spacing } from '@fonzkart/ui';

/** `hint`: the picture format this place needs, shown next to the upload button. */
export function ImageField({ label, value, onChange, hint }: { label: string; value: string; onChange: (path: string) => void; hint?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async () => {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow access to photos to upload a picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setBusy(true);
    try {
      onChange(await uploadImage({ uri: asset.uri, name: asset.fileName ?? `picture-${Date.now()}.png`, type: asset.mimeType ?? 'image/png' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <RemoteImage uri={value || null} label={label} size={56} />
        <View style={styles.flex}>
          <TextField label={label} value={value} onChangeText={onChange} autoCapitalize="none" placeholder="/models/brand/x.png or https://…" />
        </View>
      </View>
      <Button title={value ? 'Upload a different picture' : 'Upload a picture'} variant="secondary" loading={busy} onPress={() => void pick()} />
      {hint ? (
        <View style={styles.hint}>
          <Text style={styles.hintTitle}>Photo format</Text>
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      ) : null}
      {error ? <Notice tone="error" text={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  hint: { borderRadius: radius.sm, borderWidth: 1, borderColor: colors.info.border, backgroundColor: colors.info.background, padding: spacing.sm, gap: 2 },
  hintTitle: { fontSize: font.small, fontWeight: '800', color: colors.info.text },
  hintText: { fontSize: font.small, color: colors.info.text, lineHeight: 18 },
});
