// Where Fonzkart works today, as in the apps (mobile/packages/core/src/cities.ts). Every active city is listed; the
// ones below are live and every other one is "coming soon". To open a city, add it here and in the apps.

export const LIVE_CITIES = ['Bengaluru'];

const SHOWN_AS: Record<string, string> = { bangalore: 'Bengaluru', bengaluru: 'Bengaluru', gurgaon: 'Gurugram', bombay: 'Mumbai' };

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
