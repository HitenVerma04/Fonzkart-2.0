// Layout pieces for the staff apps (Partner, Admin): cards, label/value rows, segmented tabs and a list picker.
import type { ReactNode } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from './theme';

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.card}>
      {title || right ? (
        <View style={styles.cardHead}>
          {title ? <Text style={styles.cardTitle}>{title}</Text> : <View />}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>{value || '—'}</Text>
    </View>
  );
}

/** Tabs as one row of buttons; counts are shown next to labels. */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.segments} accessibilityRole="tablist">
      {options.map(o => {
        const selected = o.id === value;
        return (
          <Pressable key={o.id} onPress={() => onChange(o.id)} accessibilityRole="tab" accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentOn]}>
            <Text style={[styles.segmentText, selected && styles.segmentTextOn]} numberOfLines={1}>
              {o.label}{o.count !== undefined ? ` ${o.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A full-screen list to pick one item (an executive, a partner...). */
export function ListPicker<T>({ visible, title, items, keyOf, labelOf, detailOf, onPick, onClose }: {
  visible: boolean;
  title: string;
  items: T[];
  keyOf: (item: T) => string;
  labelOf: (item: T) => string;
  detailOf?: (item: T) => string | undefined;
  onPick: (item: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <FlatList
          data={items}
          keyExtractor={keyOf}
          contentContainerStyle={styles.sheetList}
          ListEmptyComponent={<Text style={styles.empty}>Nothing to choose from.</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => onPick(item)} accessibilityRole="button"
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
              <Text style={styles.optionLabel}>{labelOf(item)}</Text>
              {detailOf?.(item) ? <Text style={styles.optionDetail}>{detailOf(item)}</Text> : null}
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  cardTitle: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  row: { gap: 2, marginBottom: spacing.xs },
  rowLabel: { fontSize: font.small, color: colors.muted },
  rowValue: { fontSize: font.body, fontWeight: '600', color: colors.text },
  segments: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  segment: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  segmentOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  segmentText: { fontSize: font.small, fontWeight: '700', color: colors.textSoft },
  segmentTextOn: { color: colors.white },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetTitle: { fontSize: font.heading, fontWeight: '800', color: colors.navy },
  close: { fontSize: font.body, fontWeight: '700', color: colors.green },
  sheetList: { padding: spacing.lg, gap: spacing.sm },
  option: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 2 },
  optionPressed: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  optionLabel: { fontSize: font.body, fontWeight: '700', color: colors.text },
  optionDetail: { fontSize: font.small, color: colors.muted },
  empty: { fontSize: font.body, color: colors.muted, textAlign: 'center', padding: spacing.xl },
});
