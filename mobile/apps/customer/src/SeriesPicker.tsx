// "Select series" on a brand's models screen: the brand's phone series (Realme 2 Series, Realme C Series, Realme Narzo
// Series, … worked out from the model names by groupSeries in @fonzkart/core) as a grid of tiles. Tapping a series
// shows only its models; tapping it again (or "All") shows every model. The whole panel folds away with its header for
// customers who would rather scroll or search, and the app remembers that choice for every brand.
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import type { Series } from '@fonzkart/core';
import { makeStyles, useColors } from '@fonzkart/ui';
import { Icon, Tap, radii, type, useDesign } from './design';

const KEY = 'fonzkart.seriesPanel';
// Remembered for the whole session, so the next brand opens the same way at once.
let remembered: boolean | null = null;

const storage = Platform.OS === 'web'
  ? { get: async () => globalThis.localStorage?.getItem(KEY) ?? null, set: async (v: string) => globalThis.localStorage?.setItem(KEY, v) }
  : { get: () => SecureStore.getItemAsync(KEY), set: (v: string) => SecureStore.setItemAsync(KEY, v) };

/** Whether the series panel is open: open unless the customer folded it away (remembered on the phone). */
export function useSeriesPanel(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(remembered ?? true);
  useEffect(() => {
    if (remembered !== null) return;
    storage.get().catch(() => null).then(v => {
      remembered = v !== 'closed';
      setOpen(remembered);
    });
  }, []);
  return [open, (next: boolean) => {
    remembered = next;
    setOpen(next);
    storage.set(next ? 'open' : 'closed').catch(() => undefined);
  }];
}

export function SeriesPicker({ series, selected, onSelect, open, onToggle }: {
  series: Series[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const d = useDesign();
  const current = series.find(s => s.key === selected);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: 200 }) }] }));
  const fill = d.scheme === 'dark' ? 'rgba(118,118,128,0.24)' : 'rgba(118,118,128,0.10)';

  return (
    <View style={styles.wrap}>
      <Tap onPress={onToggle} scaleTo={0.99} accessibilityRole="button" accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Hide series' : 'Choose a series'} style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.title}>Select series</Text>
          <Text style={styles.caption} numberOfLines={1}>
            {current ? `Showing ${current.label}` : open ? `${series.length} series · tap one to narrow the list` : 'Tap to pick a series instead of scrolling'}
          </Text>
        </View>
        <Text style={styles.toggle}>{open ? 'Hide' : 'Show'}</Text>
        <Animated.View style={chevron}><Icon name="chevronDown" color={colors.green} size={20} /></Animated.View>
      </Tap>

      {!open && current ? (
        // Folded away with a series chosen: it stays visible and can be cleared.
        <Tap onPress={() => onSelect(null)} accessibilityRole="button" accessibilityLabel={`Clear ${current.label}`} style={[styles.active, { backgroundColor: colors.green }]}>
          <Text style={[styles.activeText, { color: d.onGreen }]}>{current.label}</Text>
          <Icon name="close" color={d.onGreen} size={14} strokeWidth={2.6} />
        </Tap>
      ) : null}

      {open ? (
        <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOut.duration(150)} style={styles.grid}>
          <Tile label="All models" count={series.reduce((n, s) => n + s.modelIds.length, 0)} selected={!selected} fill={fill} onPress={() => onSelect(null)} />
          {series.map(s => (
            <Tile key={s.key} label={s.label} count={s.modelIds.length} selected={s.key === selected} fill={fill}
              onPress={() => onSelect(s.key === selected ? null : s.key)} />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

function Tile({ label, count, selected, fill, onPress }: { label: string; count: number; selected: boolean; fill: string; onPress: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  const d = useDesign();
  return (
    <Tap onPress={onPress} scaleTo={0.96} accessibilityRole="button" accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${count} model${count === 1 ? '' : 's'}`}
      style={[styles.tile, { backgroundColor: selected ? colors.green : fill }]}>
      <Text style={[styles.tileLabel, selected && { color: d.onGreen }]} numberOfLines={2}>{label}</Text>
      <Text style={[styles.tileCount, selected && { color: d.onGreen }]}>{count}</Text>
    </Tap>
  );
}

const useStyles = makeStyles(colors => ({
  wrap: { gap: 10, marginBottom: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  headText: { flex: 1, gap: 1 },
  title: { ...type.body, fontSize: 17, fontWeight: '800', color: colors.text },
  caption: { ...type.small, color: colors.muted },
  toggle: { ...type.small, fontWeight: '700', color: colors.green },
  active: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 8 },
  activeText: { ...type.small, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexBasis: '31%', flexGrow: 0, minHeight: 58, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  tileLabel: { ...type.small, fontWeight: '600', color: colors.text, textAlign: 'center' },
  tileCount: { fontSize: 11, fontWeight: '600', color: colors.muted },
}));
