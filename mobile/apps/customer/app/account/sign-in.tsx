import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { authApi } from '@fonzkart/api';
import { Button, Notice, TextField, colors, font, spacing } from '@fonzkart/ui';
import { networkMessage, useAuthOutcome } from '../../src/authFlow';
import { PAGE_PADDING } from '../../src/grid';

export default function SignIn() {
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
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Sign in</Text>
      {notice ? <Notice tone="success" text={notice} /> : null}
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
      <View style={styles.links}>
        <Button title="Forgot password?" variant="link" onPress={() => router.push({ pathname: '/account/forgot', params: { returnTo: returnTo ?? '' } })} />
        <Button
          title="Create account"
          variant="link"
          onPress={() => router.push({ pathname: '/account/sign-up', params: { returnTo: returnTo ?? '' } })}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
});
