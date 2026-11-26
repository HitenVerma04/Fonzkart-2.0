// Where Fonzkart works today. The app and the website list every active city; the ones below are live, every other one
// is shown as "coming soon". To open a city, add it here (and in the website's lib/cities.ts).

/** The cities Fonzkart serves today, by the name customers know. */
export const LIVE_CITIES = ['Bengaluru'];

/** Other spellings in the city list, by the name to show. */
const SHOWN_AS: Record<string, string> = { bangalore: 'Bengaluru', bengaluru: 'Bengaluru', gurgaon: 'Gurugram', bombay: 'Mumbai' };

/** Shown until the city list arrives (or when it cannot be loaded). */
export const FALLBACK_CITIES = ['Bengaluru', 'Hyderabad', 'Chennai', 'Mumbai', 'Pune', 'Delhi', 'Kolkata', 'Ahmedabad', 'Kochi', 'Jaipur'];

export type ServedCity = { name: string; live: boolean };

export function cityName(name: string): string {
  const trimmed = name.trim();
  return SHOWN_AS[trimmed.toLowerCase()] ?? trimmed;
}

export function isLiveCity(name: string): boolean {
  return LIVE_CITIES.includes(cityName(name));
}

/** The cities to show: live ones first, then the rest A to Z, each once. */
export function servedCities(names: readonly string[] | undefined): ServedCity[] {
  const seen = new Set<string>();
  const all: ServedCity[] = [];
  for (const raw of [...LIVE_CITIES, ...(names?.length ? names : FALLBACK_CITIES)]) {
    const name = cityName(raw);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    all.push({ name, live: isLiveCity(name) });
  }
  return [...all.filter(c => c.live), ...all.filter(c => !c.live).sort((a, b) => a.name.localeCompare(b.name))];
}
