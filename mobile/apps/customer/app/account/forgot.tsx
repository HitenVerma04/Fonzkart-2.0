import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { authApi } from '@fonzkart/api';
import { Button, Notice, TextField, colors, font, spacing } from '@fonzkart/ui';
import { networkMessage } from '../../src/authFlow';
import { PAGE_PADDING } from '../../src/grid';

export default function Forgot() {
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
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Reset password</Text>
      {step === 'email' ? (
        <>
          <Text style={styles.text}>Enter your registered email. We'll send a 6-digit code.</Text>
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
        </>
      ) : (
        <>
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
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  text: { fontSize: font.body, color: colors.textSoft },
});
