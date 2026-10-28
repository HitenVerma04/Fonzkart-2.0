import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { authApi } from '@fonzkart/api';
import { Logo, makeStyles } from '@fonzkart/ui';
import { networkMessage } from '../../src/authFlow';
import { Appear, Button, Notice, Page, TextField, type, useDesign } from '../../src/design';

export default function Forgot() {
  const styles = useStyles();
  const d = useDesign();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(networkMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () => run(async () => {
    const result = await authApi.requestPasswordReset(email);
    if (result.kind === 'error') setError(result.message);
    else setStep('code');
  });

  const reset = () => run(async () => {
    const result = await authApi.resetPassword(email, otp, password);
    if (result.kind === 'error') setError(result.message);
    else router.replace({ pathname: '/account/sign-in', params: { notice: result.message, returnTo: returnTo ?? '' } });
  });

  return (
    <Page>
      <Appear style={styles.hero}>
        <View style={[styles.disc, { boxShadow: d.shadow.green }]}><Logo variant="f" height={52} /></View>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>
          {step === 'email' ? "Enter your registered email. We'll send a 6-digit code." : 'Enter the code and choose a new password.'}
        </Text>
      </Appear>
      {step === 'email' ? (
        <Appear key="email" index={1} style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="john@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
          {error ? <Notice tone="error" text={error} /> : null}
          <Button title="Send code" onPress={sendCode} loading={busy} disabled={!email.trim()} />
        </Appear>
      ) : (
        <Appear key="code" index={1} style={styles.form}>
          <Notice tone="success" text={`Code sent to ${email.trim()}. It is valid for 15 minutes.`} />
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
          <TextField
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
          {error ? <Notice tone="error" text={error} /> : null}
          <Button title="Set new password" onPress={reset} loading={busy} disabled={otp.length !== 6 || !password} />
          <Button title="Use a different email" variant="link" onPress={() => { setStep('email'); setOtp(''); setError(null); }} />
        </Appear>
      )}
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
}));
