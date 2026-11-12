// The pincode editor of the website's city cards (components/admin/PincodeInput.tsx): the pincodes as chips with a
// remove button, a box to add one, and "Add all", which for a city fills in the city's known pincodes and for a
// partner assigns every pincode of its city (a partner may only serve pincodes on its city's master list).
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, font, makeStyles, radius, spacing, useColors } from '@fonzkart/ui';

/** The pincode ranges the website fills in instantly for its launch cities. */
const KNOWN: Record<string, [prefix: string, count: number]> = {
  bangalore: ['560', 110],
  bengaluru: ['560', 110],
  chennai: ['600', 130],
  coimbatore: ['641', 60],
  madurai: ['625', 25],
};

/** Every pincode of a city: the known range, else India Post's directory (as on the website). */
async function cityPincodes(cityName: string): Promise<string[]> {
  const known = KNOWN[cityName.trim().toLowerCase()];
  if (known) return Array.from({ length: known[1] }, (_, i) => `${known[0]}${String(i + 1).padStart(3, '0')}`);
  const response = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(cityName.trim())}`);
  const data = await response.json() as { Status?: string; PostOffice?: { Pincode: string }[] }[];
  const offices = data?.[0]?.Status === 'Success' ? data[0].PostOffice ?? [] : [];
  return [...new Set(offices.map(o => o.Pincode).filter(p => /^\d{6}$/.test(p)))];
}

export function PincodeEditor({ visible, title, note, initial, cityName, master, onSave, onClose }: {
  visible: boolean;
  title: string;
  note?: string;
  initial: string[];
  /** For a city: "Add all" looks up this city's pincodes. */
  cityName?: string;
  /** For a partner: its city's pincodes; only these can be added, and "Add all" adds them all. */
  master?: string[];
  onSave: (pincodes: string[]) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const [pincodes, setPincodes] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRemoved, setLastRemoved] = useState<{ code: string; at: number } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPincodes(initial);
    setInput('');
    setError(null);
    setLastRemoved(null);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const merge = (more: string[]) => setPincodes(now => [...new Set([...now, ...more])]);

  const add = () => {
    const codes = input.split(/[\s,]+/).filter(Boolean);
    if (!codes.length) return;
    const bad = codes.find(c => !/^\d{6}$/.test(c));
    if (bad) return setError(`"${bad}" is not a 6-digit pincode.`);
    const outside = master ? codes.find(c => !master.includes(c)) : undefined;
    if (outside) return setError(`${outside} is not on this city's pincode list. Add it to the city first (Cities).`);
    setError(null);
    merge(codes);
    setInput('');
  };

  const addAll = async () => {
    setError(null);
    if (master) {
      if (!master.length) setError('This city has no pincodes yet. Add them in Cities first.');
      merge(master);
      return;
    }
    if (!cityName) return;
    setLoading(true);
    try {
      const found = await cityPincodes(cityName);
      if (found.length) merge(found);
      else setError(`No pincodes found for ${cityName}.`);
    } catch {
      setError('Could not look up the pincodes. Check the connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const remove = (code: string) => {
    setPincodes(now => now.filter(c => c !== code));
    setLastRemoved({ code, at: pincodes.indexOf(code) });
  };

  const undo = () => {
    if (!lastRemoved) return;
    setPincodes(now => {
      const next = [...now];
      next.splice(Math.min(lastRemoved.at, next.length), 0, lastRemoved.code);
      return [...new Set(next)];
    });
    setLastRemoved(null);
  };

  const canAddAll = Boolean(master || cityName);
  const changed = pincodes.length !== initial.length || pincodes.some((p, i) => p !== initial[i]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          {note ? <Text style={styles.note}>{note}</Text> : null}

          <View style={styles.countRow}>
            <Text style={styles.label}>ASSIGNED PINCODES · {pincodes.length}</Text>
            {pincodes.length ? (
              <Pressable onPress={() => { setPincodes([]); setLastRemoved(null); }} hitSlop={8} accessibilityRole="button">
                <Text style={styles.clear}>Remove all</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView style={styles.chipsBox} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
            {pincodes.length ? pincodes.map(p => (
              <Pressable key={p} onPress={() => remove(p)} style={styles.chip} accessibilityRole="button" accessibilityLabel={`Remove ${p}`}>
                <Text style={styles.chipText}>{p}</Text>
                <Text style={styles.chipX}>×</Text>
              </Pressable>
            )) : <Text style={styles.note}>No pincodes yet. Type one below{canAddAll ? ' or tap Add all' : ''}.</Text>}
          </ScrollView>

          {lastRemoved ? (
            <View style={styles.undoRow}>
              <Text style={styles.note}>Removed {lastRemoved.code}</Text>
              <Pressable onPress={undo} hitSlop={8} accessibilityRole="button"><Text style={styles.undo}>Undo</Text></Pressable>
            </View>
          ) : null}

          <View style={styles.addRow}>
            <TextInput
              value={input}
              onChangeText={t => { setInput(t.replace(/[^\d,\s]/g, '')); setError(null); }}
              onSubmitEditing={add}
              placeholder="Enter pincode (e.g. 560032)"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              returnKeyType="done"
              style={styles.input}
            />
            <Pressable onPress={add} style={[styles.small, styles.addButton]} accessibilityRole="button">
              <Text style={styles.addText}>+ Add</Text>
            </Pressable>
            {canAddAll ? (
              <Pressable onPress={() => void addAll()} disabled={loading} style={[styles.small, styles.allButton]} accessibilityRole="button"
                accessibilityLabel={master ? 'Assign all city pincodes' : `Add all pincodes of ${cityName}`}>
                {loading ? <ActivityIndicator size="small" color={colors.green} /> : <Text style={styles.allText}>⤓ Add all</Text>}
              </Pressable>
            ) : null}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <View style={styles.action}><Button title="Cancel" variant="secondary" onPress={onClose} /></View>
            <View style={styles.action}><Button title={changed ? 'Save' : 'Saved'} disabled={!changed} onPress={() => onSave(pincodes)} /></View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles(colors => ({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'center', padding: spacing.lg },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, maxWidth: 520, width: '100%', alignSelf: 'center', maxHeight: '90%' },
  title: { fontSize: font.heading, fontWeight: '800', color: colors.navy },
  note: { fontSize: font.small, color: colors.muted },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: font.small, fontWeight: '700', color: colors.muted, letterSpacing: 0.6 },
  clear: { fontSize: font.small, fontWeight: '700', color: colors.danger },
  chipsBox: { maxHeight: 260, flexGrow: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.greenTint, borderWidth: 1, borderColor: colors.green,
  },
  chipText: { fontSize: font.small, fontWeight: '700', color: colors.text },
  chipX: { fontSize: font.body, fontWeight: '700', color: colors.muted },
  undoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  undo: { fontSize: font.small, fontWeight: '800', color: colors.green },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1, minWidth: 0, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12,
    fontSize: font.body, color: colors.text, backgroundColor: colors.background,
  },
  small: { height: 44, paddingHorizontal: 12, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  addButton: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  addText: { fontSize: font.small, fontWeight: '700', color: colors.text },
  allButton: { backgroundColor: colors.greenTint, borderWidth: 1, borderColor: colors.green },
  allText: { fontSize: font.small, fontWeight: '700', color: colors.green },
  error: { fontSize: font.small, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
}));
