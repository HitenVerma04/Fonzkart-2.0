// A small dialog asking for one line of text (a reason, a payment reference). React Native's Alert.prompt is
// iPhone-only, so the apps use this on both platforms.
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { TextField } from './TextField';
import { colors, font, radius, spacing } from './theme';

export function TextPrompt({ visible, title, message, label, placeholder, confirmLabel, required, keyboardType, onSubmit, onClose }: {
  visible: boolean;
  title: string;
  message?: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  required?: boolean;
  keyboardType?: 'default' | 'number-pad';
  onSubmit: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (visible) setText('');
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <TextField label={label} value={text} onChangeText={setText} placeholder={placeholder} autoFocus keyboardType={keyboardType} />
          <View style={styles.actions}>
            <View style={styles.action}><Button title="Cancel" variant="secondary" onPress={onClose} /></View>
            <View style={styles.action}>
              <Button title={confirmLabel} disabled={required && !text.trim()} onPress={() => onSubmit(text.trim())} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'center', padding: spacing.lg },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontSize: font.heading, fontWeight: '800', color: colors.navy },
  message: { fontSize: font.small, color: colors.muted },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
});
