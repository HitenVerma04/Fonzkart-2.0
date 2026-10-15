// Write an email from one of the caller's Fonzkart mailboxes (the server checks the mailbox is theirs).
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { emailApi } from '@fonzkart/api';
import { Button, Notice, TextField, spacing } from '@fonzkart/ui';

export default function Compose() {
  const params = useLocalSearchParams<{ from?: string; to?: string; subject?: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const [from, setFrom] = useState(params.from ?? '');
  const [to, setTo] = useState(params.to ?? '');
  const [subject, setSubject] = useState(params.subject ?? '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      await emailApi.send({ fromAccount: from.trim(), to: to.trim(), subject: subject.trim(), text });
      await client.invalidateQueries({ queryKey: ['staff', 'email'] });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <TextField label="From (your mailbox)" value={from} onChangeText={setFrom} autoCapitalize="none" keyboardType="email-address" />
      <TextField label="To" value={to} onChangeText={setTo} autoCapitalize="none" keyboardType="email-address" />
      <TextField label="Subject" value={subject} onChangeText={setSubject} />
      <TextField label="Message" value={text} onChangeText={setText} multiline style={styles.message} />
      {error ? <Notice tone="error" text={error} /> : null}
      <Button title="Send" loading={busy} disabled={!from.trim() || !to.trim() || !subject.trim() || !text.trim()} onPress={() => void send()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 900, width: '100%', alignSelf: 'center' },
  message: { minHeight: 160, textAlignVertical: 'top' },
});
