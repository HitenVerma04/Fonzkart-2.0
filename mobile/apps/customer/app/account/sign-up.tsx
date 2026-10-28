import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { authApi } from '@fonzkart/api';
import { Logo, makeStyles } from '@fonzkart/ui';
import { networkMessage, useAuthOutcome } from '../../src/authFlow';
import { Appear, Button, Notice, Page, TextField, type, useDesign } from '../../src/design';

export default function SignUp() {
  const styles = useStyles();
  const d = useDesign();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const handle = useAuthOutcome(returnTo);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Same fields and checks as the website's sign-up form (10-digit phone; the server adds +91).
  const complete = name.trim() && email.trim() && /^\d{10}$/.test(phone) && password;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setError(await handle(await authApi.signUp({ name, email, phone, password })));
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
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Sell your devices in minutes and get paid at your door.</Text>
      </Appear>
      <Appear index={1} style={styles.form}>
        <TextField label="Full name" value={name} onChangeText={setName} placeholder="John Doe" autoComplete="name" textContentType="name" />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="john@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextField
          label="Phone number"
          prefix="+91"
          value={phone}
          onChangeText={text => setPhone(text.replace(/\D/g, '').slice(0, 10))}
          placeholder="9876543210"
          keyboardType="phone-pad"
          maxLength={10}
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Text style={styles.hint}>We'll email you a 6-digit code to confirm your address.</Text>
        {error ? <Notice tone="error" text={error} /> : null}
        <Button title="Create account" onPress={submit} loading={busy} disabled={!complete} />
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
  hint: { ...type.small, color: colors.muted },
}));
