'use client';

// The bottom of the home page: Fonzkart's journey across India. India's outline (official boundaries, from DataMeet,
// see lib/india-outline.ts) with the cities as lights at their real places: Bengaluru glows green and pulses, the other
// cities twinkle as "coming soon", with routes reaching out from Bengaluru. Then the promise that we are working to get
// there, a few numbers, and the cities as chips with a Live / Coming soon tag above each.
import { useState } from 'react';
import { servedCities, type ServedCity } from '@/lib/cities';
import { INDIA_FRAME, INDIA_OUTLINE } from '@/lib/india-outline';

const LIVE = '#4ade80';
const SOON = '#fcd34d';
const CHIPS_SHOWN = 12;

const PLACES: Record<string, [number, number]> = {
    Ahmedabad: [23.02, 72.57], Bengaluru: [12.97, 77.59], Bhopal: [23.26, 77.41], Bhubaneswar: [20.3, 85.82],
    Chandigarh: [30.73, 76.78], Chennai: [13.08, 80.27], Coimbatore: [11.02, 76.96], Dehradun: [30.32, 78.03],
    Delhi: [28.61, 77.21], Faridabad: [28.41, 77.32], Ghaziabad: [28.67, 77.45], Gurugram: [28.46, 77.03],
    Guwahati: [26.14, 91.74], Hyderabad: [17.39, 78.49], Indore: [22.72, 75.86], Jaipur: [26.91, 75.79],
    Kochi: [9.93, 76.27], Kolkata: [22.57, 88.36], Lucknow: [26.85, 80.95], Ludhiana: [30.9, 75.86],
    Madurai: [9.93, 78.12], Mumbai: [19.08, 72.88], Mysuru: [12.3, 76.64], Nagpur: [21.15, 79.09],
    Nashik: [20.0, 73.79], 'Navi Mumbai': [19.03, 73.03], Noida: [28.54, 77.39], Patna: [25.59, 85.14],
    Pune: [18.52, 73.86], Raipur: [21.25, 81.63], Ranchi: [23.34, 85.31], Surat: [21.17, 72.83],
    Thane: [19.22, 72.98], Thiruvananthapuram: [8.52, 76.94], Vadodara: [22.31, 73.18], Vijayawada: [16.51, 80.65],
    Visakhapatnam: [17.69, 83.22], Kanpur: [26.45, 80.33], Agra: [27.18, 78.01], Varanasi: [25.32, 82.97],
    Amritsar: [31.63, 74.87], Srinagar: [34.08, 74.8], Jammu: [32.73, 74.86], Mangaluru: [12.91, 74.86],
};
const ROUTES = ['Hyderabad', 'Chennai', 'Mumbai', 'Pune', 'Delhi', 'Kolkata', 'Ahmedabad', 'Kochi'];
const { west, east, north, south, width: W, height: H } = INDIA_FRAME;
const at = (name: string) => {
    const p = PLACES[name];
    return p ? { x: ((p[1] - west) / (east - west)) * W, y: ((north - p[0]) / (north - south)) * H } : null;
};

export function IndiaJourney({ cityNames }: { cityNames: string[] }) {
    const cities = servedCities(cityNames);
    const live = cities.filter(c => c.live);
    const soon = cities.length - live.length;
    const [all, setAll] = useState(false);
    const shown = all ? cities : cities.slice(0, CHIPS_SHOWN);

    return (
        <section className="w-full px-4 py-16 md:px-6 md:py-24">
            <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] border border-emerald-400/20 bg-[linear-gradient(172deg,#020617_0%,#071a24_45%,#053b2a_100%)] p-6 md:p-12">
                <div className="pointer-events-none absolute -left-32 -top-40 h-[420px] w-[420px] rounded-full bg-sky-400/15 blur-[100px]" />
                <div className="pointer-events-none absolute -bottom-48 -right-40 h-[480px] w-[480px] rounded-full bg-emerald-400/25 blur-[110px]" />

                <div className="relative grid items-center gap-10 md:grid-cols-[1.05fr_1fr]">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75 motion-reduce:animate-none" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
                            </span>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-green-400">Our journey across India</span>
                        </div>
                        <h2 className="text-4xl font-black leading-[1.05] tracking-tight text-emerald-50 md:text-6xl">
                            {live.map(c => c.name).join(', ')} today.<br />
                            <span className="bg-gradient-to-r from-green-300 via-emerald-200 to-amber-200 bg-clip-text text-transparent">India next.</span>
                        </h2>
                        <p className="max-w-xl text-base leading-relaxed text-emerald-50/85 md:text-lg">
                            We are working hard, every single day, to bring Fonzkart to every corner of India: selling, buying, repairs and
                            refurbished devices, right at your doorstep.
                        </p>
                        <div className="grid max-w-md grid-cols-3 gap-3">
                            <Stat value={String(live.length)} label={live.length === 1 ? 'City live' : 'Cities live'} color="text-green-400" />
                            <Stat value={`${soon}+`} label="Coming soon" color="text-amber-300" />
                            <Stat value="India" label="Up next" color="text-cyan-200" />
                        </div>
                    </div>

                    <div>
                        <CityLights cities={cities} />
                        <div className="mt-3 flex justify-center gap-5 text-xs font-semibold text-emerald-50/75">
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]" />Live now</span>
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" />Coming soon</span>
                        </div>
                        <p className="mt-2 text-center text-[10px] text-emerald-50/40">
                            Map outline: <a href="https://github.com/datameet/maps" target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-50/70">DataMeet</a>. Not to scale.
                        </p>
                    </div>
                </div>

                <div className="relative mt-10 flex flex-wrap gap-x-2.5 gap-y-4">
                    {shown.map(c => <CityChip key={c.name} city={c} />)}
                </div>
                {cities.length > CHIPS_SHOWN ? (
                    <button type="button" onClick={() => setAll(v => !v)} className="relative mt-4 text-sm font-extrabold text-green-400 hover:underline">
                        {all ? 'Show fewer cities' : `See all ${cities.length} cities`}
                    </button>
                ) : null}

                <div className="relative mt-8 border-t border-white/10 pt-6 text-center text-sm text-emerald-50/70">
                    Your city is next. Built with <span className="text-red-400">♥</span> in Bengaluru, for all of India.
                </div>
            </div>
        </section>
    );
}

function CityLights({ cities }: { cities: ServedCity[] }) {
    const drawn = cities.flatMap(c => { const p = at(c.name); return p ? [{ ...c, ...p }] : []; });
    const home = drawn.find(c => c.live);
    const routes = home ? ROUTES.flatMap(name => {
        const to = drawn.find(c => c.name === name);
        if (!to) return [];
        const mx = (home.x + to.x) / 2, my = (home.y + to.y) / 2, dx = to.x - home.x, dy = to.y - home.y;
        return [`M${home.x.toFixed(1)} ${home.y.toFixed(1)} Q${(mx - dy * 0.18).toFixed(1)} ${(my + dx * 0.18).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`];
    }) : [];
    const label = live(drawn);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto w-full max-w-[460px]" role="img"
            aria-label={`City lights: ${label} live, ${drawn.filter(c => !c.live).length} more cities coming soon`}>
            <defs>
                <linearGradient id="ij-land" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={LIVE} stopOpacity="0.10" />
                    <stop offset="1" stopColor={LIVE} stopOpacity="0.20" />
                </linearGradient>
                <radialGradient id="ij-soon"><stop offset="0" stopColor={SOON} stopOpacity="0.55" /><stop offset="1" stopColor={SOON} stopOpacity="0" /></radialGradient>
                <radialGradient id="ij-live"><stop offset="0" stopColor={LIVE} stopOpacity="0.9" /><stop offset="1" stopColor={LIVE} stopOpacity="0" /></radialGradient>
                <style>{`
                    @keyframes ij-twinkle { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
                    @keyframes ij-ring { 0% { transform: scale(.1); opacity: .75 } 100% { transform: scale(1); opacity: 0 } }
                    @keyframes ij-flow { to { stroke-dashoffset: -40 } }
                    .ij-t { animation: ij-twinkle 2.4s ease-in-out infinite }
                    .ij-r { animation: ij-ring 2.2s ease-out infinite; transform-box: fill-box; transform-origin: center }
                    .ij-f { animation: ij-flow 2.6s linear infinite }
                    @media (prefers-reduced-motion: reduce) { .ij-t, .ij-r, .ij-f { animation: none } .ij-r { opacity: 0 } }
                `}</style>
            </defs>
            <path d={INDIA_OUTLINE} fill="url(#ij-land)" stroke={LIVE} strokeOpacity={0.5} strokeWidth={1.1} strokeLinejoin="round" />
            {routes.map((d, i) => <path key={`a${i}`} d={d} stroke={LIVE} strokeOpacity={0.22} strokeWidth={1.2} strokeDasharray="3 5" fill="none" />)}
            {routes.map((d, i) => <path key={`b${i}`} className="ij-f" d={d} stroke={LIVE} strokeOpacity={0.6} strokeWidth={1.6} strokeDasharray="1 9" strokeLinecap="round" fill="none" />)}
            {drawn.filter(c => !c.live).map((c, i) => (
                <g key={c.name} className="ij-t" style={{ animationDelay: `${(i % 3) * 0.8}s` }}>
                    <circle cx={c.x} cy={c.y} r={9} fill="url(#ij-soon)" />
                    <circle cx={c.x} cy={c.y} r={2.8} fill={SOON}><title>{`${c.name}: coming soon`}</title></circle>
                </g>
            ))}
            {home ? (
                <g>
                    <circle className="ij-r" cx={home.x} cy={home.y} r={34} fill="none" stroke={LIVE} strokeWidth={1.5} />
                    <circle className="ij-r" cx={home.x} cy={home.y} r={34} fill="none" stroke={LIVE} strokeWidth={1.5} style={{ animationDelay: '1.1s' }} />
                    <circle cx={home.x} cy={home.y} r={17} fill="url(#ij-live)" />
                    <circle cx={home.x} cy={home.y} r={5} fill="#ecfdf5" stroke={LIVE} strokeWidth={2} />
                    <text x={home.x + 11} y={home.y + 4} fill="#ecfdf5" fontSize="13" fontWeight="800">{home.name}</text>
                    <rect x={home.x + 11 + home.name.length * 7.6} y={home.y - 7} width="30" height="13" rx="4" fill={LIVE} />
                    <text x={home.x + 26 + home.name.length * 7.6} y={home.y + 3} fill="#052e16" fontSize="8.5" fontWeight="900" textAnchor="middle">LIVE</text>
                </g>
            ) : null}
        </svg>
    );
}

const live = (cities: { name: string; live: boolean }[]) => cities.filter(c => c.live).map(c => c.name).join(', ');

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-center">
            <div className={`text-2xl font-black ${color}`}>{value}</div>
            <div className="text-[11px] font-bold text-emerald-50/70">{label}</div>
        </div>
    );
}

function CityChip({ city }: { city: ServedCity }) {
    return (
        <div className="relative pt-2.5">
            <span className={`absolute left-3 top-0 z-10 whitespace-nowrap rounded-md px-1.5 py-px text-[8.5px] font-black tracking-wider ${city.live ? 'bg-green-400 text-green-950' : 'border border-amber-300/55 bg-amber-950 text-amber-300'}`}>
                {city.live ? 'LIVE' : 'COMING SOON'}
            </span>
            <span className={`inline-flex min-w-[104px] items-center gap-1.5 rounded-full border px-3 pb-1.5 pt-2 text-[13px] font-bold ${city.live ? 'border-green-400/60 bg-green-400/15 text-emerald-50' : 'border-white/15 bg-white/5 text-emerald-50/80'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${city.live ? 'bg-green-400' : 'bg-amber-300'}`} />
                {city.name}
            </span>
        </div>
    );
}
