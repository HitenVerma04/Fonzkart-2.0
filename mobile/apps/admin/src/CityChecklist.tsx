// Choose every city a partner is responsible for: a searchable checklist (tick a city to add it, tick again to take it
// off) with the chosen cities as chips on top. One of them is the partner's main city (shown first everywhere, and the
// one older screens and the website show); tap "Make main" on a chosen city to change it. Cities this person may not
// change (another zonal head's) are shown ticked and greyed out.
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import type { City } from '@fonzkart/api';
import { Button, SearchField, font, makeStyles, radius, spacing } from '@fonzkart/ui';

export function CityChecklist({ visible, title, cities, initial, initialMain, locked = [], onSave, onClose, saveLabel = 'Save cities' }: {
  visible: boolean;
  title: string;
  /** The cities that can be chosen. */
  cities: City[];
  /** The cities chosen now, main city first. */
  initial: string[];
  initialMain?: string | null;
  /** Chosen cities this person cannot change (shown ticked, greyed out). */
  locked?: City[];
  onSave: (cityIds: string[], mainCityId: string | undefined) => void;
  onClose: () => void;
  saveLabel?: string;
}) {
  const styles = useStyles();
  const [chosen, setChosen] = useState<string[]>([]);
  const [main, setMain] = useState<string | undefined>();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return;
    setChosen(initial);
    setMain(initialMain ?? initial[0]);
    setQuery('');
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const lockedIds = useMemo(() => new Set(locked.map(c => c.id)), [locked]);
  const all = useMemo(() => {
    const byId = new Map<string, City>();
    for (const c of [...locked, ...cities]) byId.set(c.id, c);
    return [...byId.values()];
  }, [cities, locked]);
  const nameOf = (id: string) => all.find(c => c.id === id)?.name ?? 'Unknown city';
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? all.filter(c => c.name.toLowerCase().includes(q)) : all;
    // Chosen cities first, then by name.
    return [...list].sort((a, b) => Number(chosen.includes(b.id)) - Number(chosen.includes(a.id)) || a.name.localeCompare(b.name));
  }, [all, query, chosen]);

  const toggle = (id: string) => {
    if (lockedIds.has(id)) return;
    setChosen(now => {
      const next = now.includes(id) ? now.filter(x => x !== id) : [...now, id];
      setMain(m => (m && next.includes(m) ? m : next[0]));
      return next;
    });
  };
  const changed = chosen.length !== initial.length || chosen.some(id => !initial.includes(id)) || (main ?? initial[0]) !== (initialMain ?? initial[0]);
  const ordered = main && chosen.includes(main) ? [main, ...chosen.filter(id => id !== main)] : chosen;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <View style={styles.top}>
          <Text style={styles.count}>
            {chosen.length ? `${chosen.length} cit${chosen.length === 1 ? 'y' : 'ies'} chosen` : 'No city chosen yet'}
          </Text>
          {ordered.length ? (
            <View style={styles.chips}>
              {ordered.map(id => (
                <Pressable key={id} onPress={() => toggle(id)} disabled={lockedIds.has(id)} accessibilityRole="button"
                  accessibilityLabel={`${nameOf(id)}${id === main ? ', main city' : ''}. Tap to remove`}
                  style={[styles.chip, id === main && styles.chipMain]}>
                  <Text style={[styles.chipText, id === main && styles.chipTextMain]}>
                    {id === main ? '★ ' : ''}{nameOf(id)}{lockedIds.has(id) ? '' : '  ✕'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <SearchField placeholder={`Search ${all.length} cities`} value={query} onChangeText={setQuery} />
        </View>
        <FlatList
          data={shown}
          keyExtractor={c => c.id}
          extraData={[chosen, main]}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No city matches "{query.trim()}".</Text>}
          renderItem={({ item: c }) => {
            const on = chosen.includes(c.id);
            const isLocked = lockedIds.has(c.id);
            return (
              <Pressable onPress={() => toggle(c.id)} disabled={isLocked} accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: isLocked }}
                style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && styles.rowPressed, isLocked && styles.rowLocked]}>
                <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.tick}>✓</Text> : null}</View>
                <View style={styles.flex}>
                  <Text style={styles.name}>{c.name}{c.isActive === false ? ' (paused)' : ''}</Text>
                  <Text style={styles.detail}>
                    {isLocked ? 'Managed by another zonal head' : `${c.pincodes?.length ?? 0} pincodes`}
                  </Text>
                </View>
                {on && !isLocked ? (
                  c.id === main
                    ? <Text style={styles.mainTag}>Main city</Text>
                    : <Pressable onPress={() => setMain(c.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Make ${c.name} the main city`}>
                        <Text style={styles.makeMain}>Make main</Text>
                      </Pressable>
                ) : null}
              </Pressable>
            );
          }}
        />
        <View style={styles.foot}>
          <Text style={styles.hint}>The main city (★) is shown first and on the website. Pincodes of a city you take off leave the partner's service areas.</Text>
          <Button title={saveLabel} disabled={!changed} onPress={() => onSave(ordered, main)} />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(colors => ({
  sheet: { flex: 1, backgroundColor: colors.background },
  head: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, padding: spacing.lg,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: font.heading, fontWeight: '800', color: colors.navy, flex: 1 },
  close: { fontSize: font.body, fontWeight: '700', color: colors.green },
  top: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  count: { fontSize: font.small, fontWeight: '800', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.greenBorder, backgroundColor: colors.greenSoft, paddingHorizontal: 12, paddingVertical: 6 },
  chipMain: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: font.small, fontWeight: '700', color: colors.text },
  chipTextMain: { color: colors.white },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xs },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  rowOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  rowPressed: { opacity: 0.75 },
  rowLocked: { opacity: 0.55 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.green, borderColor: colors.green },
  tick: { color: colors.white, fontWeight: '900', fontSize: 14 },
  flex: { flex: 1 },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  detail: { fontSize: font.tiny, color: colors.muted },
  mainTag: { fontSize: font.tiny, fontWeight: '800', color: colors.green, textTransform: 'uppercase' },
  makeMain: { fontSize: font.small, fontWeight: '700', color: colors.green },
  empty: { fontSize: font.body, color: colors.muted, textAlign: 'center', padding: spacing.xl },
  foot: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  hint: { fontSize: font.tiny, color: colors.muted },
}));
