// Phone series, worked out from the model names (the catalog has no series field), for the "Select series" chips on a
// brand's models screen: "Realme 2 Pro" → Realme 2 Series, "Realme C1 2019" → Realme C Series, "Realme Narzo 50" →
// Realme Narzo Series. When nearly every model of a brand shares its first word (iPhone, Galaxy, Redmi), the next
// word decides: iPhone 15 Series, Galaxy S Series, Redmi Note Series. Series are listed in the order their first
// model appears (the catalog lists newer and popular models first).

export interface Series {
  key: string;
  label: string;
  /** Ids of the models in this series, in catalog order. */
  modelIds: string[];
}

/** Words that describe a variant, not a series. */
const NOT_A_SERIES = new Set(['pro', 'plus', 'max', 'ultra', 'mini', 'lite', 'neo', 'prime', 'power', 'play', '5g', '4g', 'new', 'edition', 'the']);

type Token = { kind: 'number'; key: string; text: string } | { kind: 'letters'; key: string; text: string } | { kind: 'word'; key: string; text: string };

/** The model name without the brand's own words ("Samsung Galaxy S23" → ["Galaxy", "S23"]). */
function words(brandName: string, modelName: string): string[] {
  const brand = brandName.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const parts = modelName.replace(/[()]/g, ' ').trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < parts.length && i < brand.length && parts[i]!.toLowerCase() === brand[i]) i++;
  return parts.slice(i);
}

/** What one word says about the series: a number (2, 15, 7a), letters with a number (C1, S23, A54), or a word (Narzo). */
function token(word: string | undefined): Token | null {
  if (!word) return null;
  const w = word.replace(/[^\p{L}\p{N}+]/gu, '');
  if (!w || NOT_A_SERIES.has(w.toLowerCase())) return null;
  let m = /^(\d{1,3})[a-z]{0,2}\+?$/i.exec(w);
  if (m) return { kind: 'number', key: `n:${Number(m[1])}`, text: String(Number(m[1])) };
  // Letters and words share one key, so "GT2" and "GT Neo 3" are both the GT series.
  m = /^([a-z]{1,3})(\d{1,4})[a-z]{0,2}\+?$/i.exec(w);
  if (m) return { kind: 'letters', key: `s:${m[1]!.toUpperCase()}`, text: m[1]!.toUpperCase() };
  if (/^\d{4}$/.test(w)) return null; // a year ("C1 2019")
  if (/^[a-z]$/i.test(w)) return { kind: 'letters', key: `s:${w.toUpperCase()}`, text: w.toUpperCase() }; // "Z Fold 5"
  if (/^\p{L}{2,}$/u.test(w)) {
    const text = w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    return { kind: 'word', key: `s:${w.toUpperCase()}`, text };
  }
  return null;
}

/** The share of models above which a first word (iPhone, Galaxy) is the whole brand, not a series. */
const WHOLE_BRAND = 0.6;

/**
 * Groups a brand's models into series. Models whose name gives no series are left out (they still show under "All
 * models"). Fewer than two series: an empty list (nothing to choose between).
 */
export function groupSeries(brandName: string, models: { id: string; name: string }[]): Series[] {
  const first = models.map(m => {
    const ws = words(brandName, m.name);
    return { id: m.id, ws, t: token(ws[0]) };
  });
  // A first word nearly every model shares (iPhone, Galaxy, Redmi) is refined by the next word.
  const counts = new Map<string, number>();
  for (const f of first) if (f.t?.kind === 'word') counts.set(f.t.key, (counts.get(f.t.key) ?? 0) + 1);
  const isWholeBrand = (t: Token | null) =>
    t?.kind === 'word' && models.length >= 4 && (counts.get(t.key) ?? 0) / models.length >= WHOLE_BRAND;
  const label1 = (t: Token, prefix: string) => `${prefix} ${t.text} Series`.trim();
  const series = new Map<string, Series>();
  const add = (key: string, label: string, id: string) => {
    const s = series.get(key) ?? { key, label, modelIds: [] };
    s.modelIds.push(id);
    series.set(key, s);
  };
  // Models under the brand-wide word first (Galaxy S23 → Galaxy S Series) ...
  const rest: typeof first = [];
  for (const f of first) {
    if (!f.t) continue;
    if (isWholeBrand(f.t)) {
      const next = token(f.ws[1]);
      if (next) add(`${f.t.key}>${next.key}`, label1(next, f.t.text), f.id); // just "iPhone": no series
    } else {
      rest.push(f);
    }
  }
  // ... then the others, which join such a series when they name it without the brand-wide word ("Samsung A05" →
  // Galaxy A Series, "Motorola Edge 50" → Moto Edge Series). Numbers never do: "Xiaomi 15" is not "Redmi 15".
  const refined = new Map<string, string>();
  for (const key of series.keys()) refined.set(key.split('>')[1]!, key);
  for (const f of rest) {
    const joined = f.t!.kind !== 'number' ? refined.get(f.t!.key) : undefined;
    if (joined) add(joined, series.get(joined)!.label, f.id);
    else add(f.t!.key, label1(f.t!, brandName.trim()), f.id);
  }
  // In the order the series' first model appears in the catalog.
  const position = new Map(models.map((m, i) => [m.id, i]));
  const list = [...series.values()].sort((a, b) => position.get(a.modelIds[0]!)! - position.get(b.modelIds[0]!)!);
  for (const s of list) s.modelIds.sort((a, b) => position.get(a)! - position.get(b)!);
  return list.length >= 2 ? list : [];
}
