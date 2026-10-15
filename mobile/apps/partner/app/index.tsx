import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi, executiveApi, setAuthToken } from '@fonzkart/api';
import { Button, Loading, Logo, Notice, Segmented, TextField, colors, font, spacing } from '@fonzkart/ui';
import { STAFF_ELSEWHERE, usePartnerSession } from '../src/session';

type Mode = 'account' | 'rider';

export default function Start() {
  const { session, signIn } = usePartnerSession();
  const [mode, setMode] = useState<Mode>('account');
  const [id, setId] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [onboardingId, setOnboardingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session.status === 'loading') return <Loading />;
  if (session.status === 'executive') return <Redirect href="/rider" />;
  if (session.status === 'partner') return <Redirect href="/partner" />;

  const run = async (task: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    try {
      setError(await task());
    } catch (e) {
      setError(e instanceof Error && !/network|fetch/i.test(e.message) ? e.message : 'Could not reach Fonzkart. Check your internet connection.');
    } finally {
      setBusy(false);
    }
  };

  // Partner or field-executive account (the website's sign-in).
  const accountSignIn = () => run(async () => {
    const outcome = await authApi.signIn(id, password);
    if (outcome.kind === 'error') return outcome.message;
    if (outcome.kind === 'verifyEmail') return 'Verify your email on the Fonzkart website first, then sign in here.';
    setAuthToken(outcome.token);
    const user = await authApi.session();
    if (user?.role === 'PARTNER') await signIn('partner', outcome.token);
    else if (user?.role === 'FIELD_EXECUTIVE') await signIn('executive', outcome.token);
    else return STAFF_ELSEWHERE;
    return null;
  });

  // Field executive phone login; the first time, the executive sets a password.
  const riderPhone = `+91${phone}`;
  const riderSignIn = () => run(async () => {
    const response = await executiveApi.login(riderPhone, password || undefined);
    const body = response.data ?? {};
    if (body.needsOnboarding && body.id) {
      setOnboardingId(body.id);
      return null;
    }
    if (body.error) return body.error;
    if (response.authToken) {
      await signIn('executive', response.authToken);
      return null;
    }
    return 'Unexpected answer from the server. Please try again.';
  });
  const setFirstPassword = () => run(async () => {
    if (newPassword.length < 6) return 'Choose a password of at least 6 characters.';
    const response = await executiveApi.onboard(onboardingId!, newPassword);
    if (response.data?.error) return response.data.error;
    if (!response.authToken) return 'Unexpected answer from the server. Please try again.';
    await signIn('executive', response.authToken);
    return null;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Logo variant="stacked" height={120} />
          <Text style={styles.app}>Partner</Text>
        </View>
        {session.notice ? <Notice text={session.notice} /> : null}
        <Segmented<Mode>
          options={[{ id: 'account', label: 'Partner / staff account' }, { id: 'rider', label: 'Field executive (phone)' }]}
          value={mode}
          onChange={m => { setMode(m); setError(null); setOnboardingId(null); }}
        />

        {mode === 'account' ? (
          <>
            <TextField label="Email or phone number" value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false}
              placeholder="Email or 10-digit number" textContentType="username" />
            <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password"
              onSubmitEditing={() => void accountSignIn()} />
            <Button title="Sign in" loading={busy} disabled={!id.trim() || !password} onPress={() => void accountSignIn()} />
          </>
        ) : onboardingId ? (
          <>
            <Notice text="Welcome! This is your first sign-in. Choose a password for your account." />
            <TextField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry
              textContentType="newPassword" hint="At least 6 characters." />
            <Button title="Set password and continue" loading={busy} disabled={!newPassword} onPress={() => void setFirstPassword()} />
          </>
        ) : (
          <>
            <TextField label="Mobile number" value={phone} onChangeText={t => setPhone(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad" prefix="+91" placeholder="Registered number" />
            <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password"
              hint="First time? Leave it empty to set your password." onSubmitEditing={() => void riderSignIn()} />
            <Button title="Continue" loading={busy} disabled={phone.length !== 10} onPress={() => void riderSignIn()} />
          </>
        )}
        {error ? <Notice tone="error" text={error} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { padding: spacing.lg, gap: spacing.md, maxWidth: 480, width: '100%', alignSelf: 'center', paddingTop: spacing.xxl },
  brand: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  app: { fontSize: font.heading, fontWeight: '800', color: colors.green, letterSpacing: 1, textTransform: 'uppercase' },
});
