import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { authApi } from '@fonzkart/api';
import { Button, Notice, TextField, colors, font, spacing } from '@fonzkart/ui';
import { networkMessage, useAuthOutcome } from '../../src/authFlow';
import { PAGE_PADDING } from '../../src/grid';

export default function Verify() {
  const { email = '', returnTo } = useLocalSearchParams<{ email?: string; returnTo?: string }>();
  const handle = useAuthOutcome(returnTo);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setError(await handle(await authApi.verifyEmail(email, otp)));
    } catch (e) {
      setError(networkMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.text}>We sent a 6-digit code to {email}. It is valid for 15 minutes.</Text>
      <TextField
        label="Code"
        value={otp}
        onChangeText={text => setOtp(text.replace(/\D/g, '').slice(0, 6))}
        placeholder="------"
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        style={styles.code}
      />
      {error ? <Notice tone="error" text={error} /> : null}
      <Button title="Verify" onPress={submit} loading={busy} disabled={otp.length !== 6} />
      <Text style={styles.hint}>No email? Check your spam folder. Signing in again sends a new code.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  text: { fontSize: font.body, color: colors.textSoft },
  code: { fontSize: 24, letterSpacing: 8, fontWeight: '700' },
  hint: { fontSize: font.small, color: colors.muted, textAlign: 'center' },
});
