// The very bottom of the home page: a calm brand sign-off, like the footers of popular Indian apps. Big soft-faded
// words ("Bengaluru today. India tomorrow."), the Fonzkart F with the promise that we are working hard to reach every
// city, and the cities as chips: Bengaluru live, the rest with a "Coming soon" tag above. No drawing or loop, so it
// costs nothing to show.
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useActiveCities } from '@fonzkart/api';
import { servedCities, type ServedCity } from '@fonzkart/core';
import { Logo, makeStyles, useTheme } from '@fonzkart/ui';
import { radii, Tap, type } from '../design';

/** The coming-soon cities shown before "+ more". */
const FIRST = ['Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune'];

export function BrandSignOff() {
  const styles = useStyles();
  const dark = useTheme().scheme === 'dark';
  const active = useActiveCities();
  const cities = useMemo(() => servedCities(active.data), [active.data]);
  const [all, setAll] = useState(false);
  const live = cities.filter(c => c.live);
  const soon = cities.filter(c => !c.live);
  const first = [...FIRST.flatMap(name => soon.filter(c => c.name === name)), ...soon.filter(c => !FIRST.includes(c.name))];
  const shown = all ? [...live, ...first] : [...live, ...first.slice(0, FIRST.length)];
  const more = live.length + soon.length - shown.length;
  const faded = dark ? styles.fadedDark : styles.fadedLight;
  const fadedGreen = dark ? styles.fadedGreenDark : styles.fadedGreenLight;

  return (
    <View style={styles.wrap} accessible={false}>
      <Text style={[styles.big, faded]} accessibilityRole="header">{live.map(c => c.name).join(', ')}{'\n'}today.</Text>
      <Text style={[styles.big, fadedGreen]}>India{'\n'}tomorrow.</Text>

      <View style={styles.promise}>
        <View style={styles.mark}><Logo variant="f" height={30} /></View>
        <Text style={styles.promiseText}>
          We are working hard, every single day, to bring Fonzkart to every city in India. <Text style={styles.strong}>Your city is next.</Text>
        </Text>
      </View>

      <View style={styles.chips}>
        {shown.map(c => <CityChip key={c.name} city={c} />)}
        {more > 0 || all ? (
          <Tap onPress={() => setAll(v => !v)} accessibilityRole="button" style={styles.moreWrap}
            accessibilityLabel={all ? 'Show fewer cities' : `${more} more cities coming soon`}>
            <View style={styles.more}><Text style={styles.moreText}>{all ? 'Show less' : `+${more} more`}</Text></View>
          </Tap>
        ) : null}
      </View>

      <Text style={styles.made}>Made with <Text style={styles.heart}>♥</Text> in Bengaluru, for India</Text>
    </View>
  );
}

function CityChip({ city }: { city: ServedCity }) {
  const styles = useStyles();
  return (
    <View style={styles.chipWrap} accessible accessibilityLabel={`${city.name}, ${city.live ? 'live now' : 'coming soon'}`}>
      <View style={[styles.tag, city.live ? styles.tagLive : styles.tagSoon]}>
        <Text numberOfLines={1} style={[styles.tagText, city.live ? styles.tagTextLive : styles.tagTextSoon]}>{city.live ? 'LIVE' : 'COMING SOON'}</Text>
      </View>
      <View style={[styles.chip, city.live && styles.chipLive]}>
        <View style={[styles.dot, city.live ? styles.dotLive : styles.dotSoon]} />
        <Text style={[styles.chipText, city.live && styles.chipTextLive]} numberOfLines={1}>{city.name}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  wrap: { paddingTop: 20, paddingBottom: 8, gap: 16 },
  big: { fontSize: 46, lineHeight: 48, fontWeight: '900', letterSpacing: -1.8 },
  fadedLight: { color: 'rgba(17,24,39,0.16)' },
  fadedDark: { color: 'rgba(249,250,251,0.16)' },
  fadedGreenLight: { color: 'rgba(22,163,74,0.38)', marginTop: -12 },
  fadedGreenDark: { color: 'rgba(74,222,128,0.34)', marginTop: -12 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  mark: {
    width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: colors.greenBorder,
  },
  promiseText: { flex: 1, ...type.small, fontSize: 14, lineHeight: 20, color: colors.muted },
  strong: { fontWeight: '800', color: colors.navy },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 12 },
  chipWrap: { paddingTop: 8 },
  // The chip is at least as wide as its "COMING SOON" tag, so the tag never wraps over a short name.
  tag: { position: 'absolute', top: 0, left: 10, zIndex: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5 },
  tagLive: { backgroundColor: colors.green },
  tagSoon: { backgroundColor: colors.warning.background, borderWidth: 1, borderColor: colors.warning.border },
  tagText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 },
  tagTextLive: { color: '#ffffff' },
  tagTextSoon: { color: colors.warning.text },
  chip: {
    minWidth: 104, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radii.pill,
    paddingLeft: 10, paddingRight: 12, paddingTop: 9, paddingBottom: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipLive: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotLive: { backgroundColor: colors.green },
  dotSoon: { backgroundColor: '#f59e0b' },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  chipTextLive: { color: colors.navy },
  moreWrap: { paddingTop: 8 },
  more: { borderRadius: radii.pill, paddingHorizontal: 12, paddingTop: 9, paddingBottom: 7, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  moreText: { fontSize: 13, fontWeight: '800', color: colors.greenDark },
  made: { ...type.small, fontSize: 12, color: colors.muted, marginTop: 4 },
  heart: { color: '#ef4444' },
}));
