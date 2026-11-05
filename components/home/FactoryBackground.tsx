'use client';

// The home page's background, as in the Customer app: a faint line drawing of a Fonzkart factory behind everything.
// Devices arrive, are tested, repaired, packed and sent out, one station under the other. Scrolling travels through it
// more slowly than the content, reaching the last station at the end of the page. The moving parts are CSS animations of
// transforms and opacity (globals.css), a station's parts run only while it is on screen, and scrolling moves the whole
// drawing as one layer.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

const TOP = 170; // the first station starts just under the header
const BOTTOM = 120;
const SCENE = 'min(100vw, 640px)';
const STATION = 'calc(min(100vw, 640px) * 0.8205)'; // 320 / 390, the drawings' proportions

const BELT = 'M24 232H366 M24 244H366 M60 244v48 M330 244v48 M44 292h32 M314 292h32';

/** The outline of a gear, centred on (r, r). */
function gearPath(r: number, teeth: number) {
    const points: string[] = [];
    const step = (Math.PI * 2) / teeth;
    for (let i = 0; i < teeth; i += 1) {
        const a = i * step;
        [[a - step * 0.28, 0.8], [a - step * 0.14, 1], [a + step * 0.14, 1], [a + step * 0.28, 0.8]].forEach(([t, s]) => {
            points.push(`${(r + Math.cos(t) * r * s).toFixed(1)} ${(r + Math.sin(t) * r * s).toFixed(1)}`);
        });
    }
    return `M${points.join('L')}Z`;
}

const vars = (values: Record<string, string>) => values as CSSProperties;

/** `turns` is how many times it goes round in 14 seconds; negative runs backwards. */
function Gear({ x, y, r, teeth, turns }: { x: number; y: number; r: number; teeth: number; turns: number }) {
    return (
        <g transform={`translate(${x} ${y})`}>
            <g className="fac-spin" style={{ ...vars({ '--t': `${(14 / Math.abs(turns)).toFixed(2)}s`, '--d': turns < 0 ? 'reverse' : 'normal' }), transformOrigin: `${r}px ${r}px` }}>
                <path d={gearPath(r, teeth)} />
                <circle cx={r} cy={r} r={r * 0.28} />
            </g>
        </g>
    );
}

function Riders({ shape, offset = 0 }: { shape: 'phone' | 'box'; offset?: number }) {
    const w = shape === 'phone' ? 15 : 26;
    const h = shape === 'phone' ? 28 : 22;
    return (
        <>
            {[0, 1, 2].map(i => (
                <rect key={i} className="fac-ride" x={0} y={232 - h} width={w} height={h} rx={shape === 'phone' ? 3 : 2} style={{ animationDelay: `${-((offset + i / 3) % 1) * 7}s` }} />
            ))}
        </>
    );
}

function Arm({ x, y, slow }: { x: number; y: number; slow?: boolean }) {
    return (
        <g transform={`translate(${x - 42} ${y - 112})`}>
            <g className="fac-arm" style={{ ...vars({ '--t': slow ? '3.5s' : '2.33s' }), transformOrigin: '42px 112px' }}>
                <path d="M42 112 42 58 16 26M16 26l-10 8M16 26l6-12" />
                <circle cx={42} cy={58} r={5} />
            </g>
        </g>
    );
}

function Wheel({ x, y }: { x: number; y: number }) {
    return (
        <g transform={`translate(${x} ${y})`}>
            <g className="fac-spin" style={{ ...vars({ '--t': '4.67s' }), transformOrigin: '12px 12px' }}>
                <circle cx={12} cy={12} r={11} />
                <path d="M12 3v18M3 12h18" />
            </g>
        </g>
    );
}

function Pipe({ side, reverse }: { side: 'left' | 'right'; reverse?: boolean }) {
    return (
        <div className="absolute inset-y-0 w-1 overflow-hidden" style={{ [side]: 6 }}>
            <div className="absolute inset-y-0 left-[1.5px] w-px bg-primary/15" />
            <div className="fac-flow absolute inset-x-0 -top-[120px] -bottom-[120px]" style={{ ...vars({ '--d': reverse ? 'reverse' : 'normal' }), backgroundImage: 'repeating-linear-gradient(180deg, hsl(var(--primary) / 0.17) 0 8px, transparent 8px 120px)' }} />
        </div>
    );
}

const STATIONS: { d: string; parts: ReactNode }[] = [
    {
        // Collection: devices come down the chute onto the belt
        d: `${BELT} M40 118h72l-18 62h-36z M60 180v38 M240 70h136v132H240z`,
        parts: <><Gear x={252} y={84} r={44} teeth={12} turns={1} /><Gear x={326} y={140} r={22} teeth={6} turns={-2} /><Riders shape="phone" /></>,
    },
    {
        // Testing: a scanner reads each device, an arm sorts it
        d: `${BELT} M126 232V96h132v136 M116 96h152 M176 96v22h32V96 M316 232h48v-14h-48z`,
        parts: <><line className="fac-beam" x1={192} y1={118} x2={192} y2={228} /><Arm x={340} y={218} /><Riders shape="phone" offset={0.15} /></>,
    },
    {
        // Repair: the workshop's big gears
        d: 'M24 290H366 M22 52h118v62h54 M368 40v92h-84 M210 40h40v32h-40z',
        parts: <><Gear x={78} y={132} r={72} teeth={16} turns={1} /><Gear x={208} y={150} r={45} teeth={10} turns={-1.6} /><Arm x={346} y={288} slow /></>,
    },
    {
        // Packing: a press closes each box
        d: `${BELT} M152 232V78h82v154 M142 78h102 M306 218v-46h60v46z M318 172v-38h40v38z`,
        parts: <><g className="fac-press"><path d="M193 86v56" /><rect x={176} y={142} width={34} height={10} rx={2} /></g><Riders shape="box" offset={0.3} /></>,
    },
    {
        // Dispatch: out to the customer
        d: 'M24 130l50-38v38l50-38v38l50-38v38h60V54h26v76h156 M24 292H366 M60 272v-66h122v66 M182 228h52l26 24v20h-78',
        parts: (
            <>
                {[0, 1, 2].map(i => <circle key={i} className="fac-puff" cx={257} cy={53} r={7} style={{ animationDelay: `${(-i * 4.67) / 3}s`, transformOrigin: '257px 53px' }} />)}
                <Wheel x={84} y={260} />
                <Wheel x={206} y={260} />
            </>
        ),
    },
];

export function FactoryBackground() {
    const scene = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = scene.current;
        if (!el) return undefined;
        // The page scrolls in <body> or the window, depending on the browser's handling of the overflow rules.
        const scroller = () => (document.body.scrollHeight > document.body.clientHeight + 1 ? document.body : document.documentElement);
        let frame = 0;
        const move = () => {
            frame = 0;
            const page = scroller();
            const range = Math.max(1, page.scrollHeight - page.clientHeight);
            const y = Math.min(Math.max(page.scrollTop, 0), range);
            el.style.transform = `translate3d(0, ${(-y / range) * Math.max(0, el.offsetHeight - innerHeight)}px, 0)`;
        };
        const onScroll = () => {
            frame ||= requestAnimationFrame(move);
        };
        window.addEventListener('scroll', onScroll, { passive: true, capture: true });
        window.addEventListener('resize', onScroll);
        move();

        const seen = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.setAttribute('data-on', '');
                else entry.target.removeAttribute('data-on');
            });
        });
        el.querySelectorAll('.fac-station').forEach(station => seen.observe(station));
        return () => {
            window.removeEventListener('scroll', onScroll, { capture: true });
            window.removeEventListener('resize', onScroll);
            cancelAnimationFrame(frame);
            seen.disconnect();
        };
    }, []);

    return (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <div ref={scene} className="absolute inset-x-0 top-0 will-change-transform" style={{ height: `calc(${TOP + BOTTOM}px + ${STATION} * ${STATIONS.length})` }}>
                <Pipe side="left" />
                <Pipe side="right" reverse />
                {STATIONS.map(({ d, parts }, i) => (
                    <svg key={i} className="fac fac-station absolute left-1/2 -translate-x-1/2" viewBox="0 0 390 320" style={{ top: `calc(${TOP}px + ${STATION} * ${i})`, width: SCENE }}>
                        <path d={d} />
                        {parts}
                    </svg>
                ))}
            </div>
        </div>
    );
}
