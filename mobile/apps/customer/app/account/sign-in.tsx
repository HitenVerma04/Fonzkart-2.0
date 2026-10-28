import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { authApi } from '@fonzkart/api';
import { Logo, makeStyles } from '@fonzkart/ui';
import { networkMessage, useAuthOutcome } from '../../src/authFlow';
import { Appear, Button, Notice, Page, TextField, type, useDesign } from '../../src/design';

export default function SignIn() {
  const styles = useStyles();
  const d = useDesign();
  const { returnTo, notice } = useLocalSearchParams<{ returnTo?: string; notice?: string }>();
  const router = useRouter();
  const handle = useAuthOutcome(returnTo);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setError(await handle(await authApi.signIn(id, password)));
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
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to book pickups and track your orders.</Text>
      </Appear>
      {notice ? <Notice tone="success" text={notice} /> : null}
      <Appear index={1} style={styles.form}>
        <TextField
          label="Email or phone number"
          value={id}
          onChangeText={setId}
          placeholder="Email or 10-digit number"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
        />
        {error ? <Notice tone="error" text={error} /> : null}
        <Button title="Sign in" onPress={submit} loading={busy} disabled={!id.trim() || !password} />
      </Appear>
      <Appear index={2} style={styles.links}>
        <Button title="Forgot password?" variant="link" onPress={() => router.push({ pathname: '/account/forgot', params: { returnTo: returnTo ?? '' } })} />
        <Button
          title="Create account"
          variant="link"
          onPress={() => router.push({ pathname: '/account/sign-up', params: { returnTo: returnTo ?? '' } })}
        />
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
  links: { flexDirection: 'row', justifyContent: 'space-between' },
}));
