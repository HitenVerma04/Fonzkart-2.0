import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { authApi } from '@fonzkart/api';
import { Button, Notice, TextField, colors, font, spacing } from '@fonzkart/ui';
import { networkMessage, useAuthOutcome } from '../../src/authFlow';
import { PAGE_PADDING } from '../../src/grid';

export default function SignUp() {
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
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Create account</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  hint: { fontSize: font.small, color: colors.muted },
});
