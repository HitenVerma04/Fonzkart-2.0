import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { authApi } from '@fonzkart/api';
import { Logo, makeStyles } from '@fonzkart/ui';
import { networkMessage, useAuthOutcome } from '../../src/authFlow';
import { Appear, Button, Notice, Page, TextField, type, useDesign } from '../../src/design';

export default function Verify() {
  const styles = useStyles();
  const d = useDesign();
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
    <Page>
      <Appear style={styles.hero}>
        <View style={[styles.disc, { boxShadow: d.shadow.green }]}><Logo variant="f" height={52} /></View>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to {email}. It is valid for 15 minutes.</Text>
      </Appear>
      <Appear index={1} style={styles.form}>
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
      </Appear>
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  hero: { alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 6 },
  disc: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.greenTint, borderWidth: 1, borderColor: colors.greenBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  title: { ...type.title, color: colors.navy, textAlign: 'center' },
  subtitle: { ...type.body, color: colors.muted, textAlign: 'center' },
  form: { gap: 16 },
  code: { fontSize: 28, letterSpacing: 12, fontWeight: '800', textAlign: 'center' },
  hint: { ...type.small, color: colors.muted, textAlign: 'center' },
}));
