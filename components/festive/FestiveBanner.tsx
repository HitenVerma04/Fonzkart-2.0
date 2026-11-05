'use client';

// The greeting at the top of the home page while a festive theme is on, with the same decorations as the Customer app:
// the Ashoka Chakra and tricolour ribbon for the national days (kites on Independence Day), lights and a diya for
// Diwali, the crescent and a lantern for Eid, snow and a tree for Christmas. The tricolour is a ribbon, never the flag.
import type { CSSProperties, ReactNode } from 'react';
import { festiveGreeting } from '@/lib/festive';
import { useFestive } from './festive-client';

const SAFFRON = '#ff9933';
const INDIA_GREEN = '#138808';
const GOLD = '#fbbf24';

const timed = (t: number, extra: Record<string, string | number> = {}) => ({ '--t': `${t}s`, ...extra }) as CSSProperties;

function Twinkle({ t, delay = 0, children }: { t: number; delay?: number; children: ReactNode }) {
    return <span className="fz-twinkle inline-block" style={{ ...timed(t), animationDelay: `${delay}s` }}>{children}</span>;
}

function Sway({ t, degrees, children }: { t: number; degrees: number; children: ReactNode }) {
    return <span className="fz-sway inline-block" style={timed(t, { '--sway': `${degrees}deg` })}>{children}</span>;
}

function Star({ size, color }: { size: number; color: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24">
            <path d="M12 1.5c.9 6.3 3.2 9 10.5 10.5-7.3 1.5-9.6 4.2-10.5 10.5-.9-6.3-3.2-9-10.5-10.5C8.8 10.500 11.100 7.800 12 1.500z" fill={color} />
        </svg>
    );
}

function Chakra() {
    return (
        <svg className="fz-turn absolute -bottom-14 -right-10" width={150} height={150} viewBox="0 0 100 100" stroke="rgba(255,255,255,0.2)" fill="none">
            <circle cx={50} cy={50} r={46} strokeWidth={5} />
            <circle cx={50} cy={50} r={8} fill="rgba(255,255,255,0.2)" />
            {Array.from({ length: 24 }, (_, i) => (i * Math.PI) / 12).map(a => (
                <line key={a} x1={50} y1={50} x2={(50 + Math.cos(a) * 46).toFixed(2)} y2={(50 + Math.sin(a) * 46).toFixed(2)} strokeWidth={2} />
            ))}
        </svg>
    );
}

function Kite({ color, edge }: { color: string; edge: string }) {
    return (
        <svg width={24} height={41} viewBox="0 0 34 58">
            <path d="M17 1 33 19 17 39 1 19z" fill={color} stroke={edge} strokeWidth={1.2} />
            <path d="M17 1v38M1 19h32" stroke={edge} strokeWidth={0.8} />
            <path d="M17 39c-5 4 5 7 0 11s4 5 2 7" stroke={edge} strokeWidth={1.2} fill="none" />
        </svg>
    );
}

function NationalDay({ kites }: { kites?: boolean }) {
    return (
        <>
            <Chakra />
            <div className="absolute right-6 top-4 flex items-start gap-4 md:right-28">
                {kites ? (
                    <>
                        <Sway t={1.8} degrees={9}><Kite color="#ffffff" edge={INDIA_GREEN} /></Sway>
                        <Sway t={2.2} degrees={11}><Kite color={INDIA_GREEN} edge="#ffffff" /></Sway>
                    </>
                ) : (
                    <>
                        <Twinkle t={1.1}><Star size={16} color={SAFFRON} /></Twinkle>
                        <Twinkle t={1.4} delay={0.5}><Star size={12} color="#ffffff" /></Twinkle>
                        <Twinkle t={1.25} delay={0.9}><Star size={15} color="#7ee07a" /></Twinkle>
                    </>
                )}
            </div>
            <div className="absolute inset-x-0 bottom-0">
                <div className="h-[3px]" style={{ background: SAFFRON }} />
                <div className="h-[3px] bg-white" />
                <div className="h-[3px]" style={{ background: INDIA_GREEN }} />
            </div>
        </>
    );
}

const LIGHTS = [GOLD, '#fb7185', '#fde68a', '#f97316', GOLD, '#fb7185', '#fde68a', '#f97316', GOLD, '#fb7185'];

function Diwali() {
    return (
        <>
            {LIGHTS.map((color, i) => (
                <span key={i} className="absolute" style={{ left: `${6 + i * 9.6}%`, top: 4 + (i % 2) * 5 }}>
                    <Twinkle t={0.8 + (i % 3) * 0.2} delay={(i % 4) * 0.3}>
                        <span className="block h-[7px] w-[7px] rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                    </Twinkle>
                </span>
            ))}
            <div className="absolute bottom-3 right-6 flex w-11 flex-col items-center md:right-28">
                <svg className="fz-flame -mb-1" width={18} height={24} viewBox="0 0 20 28">
                    <path d="M10 0c5 8 9 12 9 18a9 9 0 0 1-18 0c0-6 4-10 9-18z" fill={GOLD} />
                    <path d="M10 11c2.5 4 4 6 4 9a4 4 0 0 1-8 0c0-3 1.5-5 4-9z" fill="#fff7d6" />
                </svg>
                <svg width={44} height={18} viewBox="0 0 60 25">
                    <path d="M1 3c10 4 48 4 58 0-3 13-15 21-29 21S4 16 1 3z" fill="#c2570c" stroke="#fde68a" strokeWidth={1.4} />
                </svg>
            </div>
            <span className="absolute right-20 top-6 md:right-44"><Twinkle t={1}><Star size={15} color={GOLD} /></Twinkle></span>
        </>
    );
}

function Eid() {
    return (
        <div className="absolute right-6 top-4 flex items-start gap-5 md:right-28">
            <Sway t={1.9} degrees={6}>
                <svg width={30} height={46} viewBox="0 0 30 46">
                    <line x1={15} y1={0} x2={15} y2={4} stroke="#f2d98c" strokeWidth={1.2} />
                    <path d="M9 4h12l4 8v18l-4 8H9l-4-8V12z" fill="#0b6b5a" stroke="#f2d98c" strokeWidth={1.4} />
                    <rect x={12} y={14} width={6} height={14} rx={3} fill="#f2d98c" />
                    <path d="M15 38v8" stroke="#f2d98c" strokeWidth={1.4} />
                </svg>
            </Sway>
            <svg className="fz-bob" width={48} height={48} viewBox="0 0 48 48" fill="#f2d98c">
                <path d="M31 3a21 21 0 1 0 14 34A18 18 0 1 1 31 3z" />
                <path d="m37 13 1.8 4.2 4.6.4-3.500 3 1 4.500-3.900-2.400-3.900 2.400 1-4.500-3.500-3 4.600-.4z" />
            </svg>
        </div>
    );
}

const FLAKES: [number, number, number][] = [[4, 3, 0], [13, 5, 0.42], [22, 2.5, 0.7], [31, 4, 0.2], [40, 3, 0.86], [49, 5, 0.55], [58, 2.5, 0.1], [67, 4, 0.66], [76, 3, 0.33], [85, 5, 0.92], [94, 3, 0.48]];

function Christmas() {
    return (
        <>
            {FLAKES.map(([left, size, phase]) => (
                <span key={left} className="fz-fall absolute top-0 rounded-full bg-white/85" style={{ left: `${left}%`, width: size, height: size, animationDelay: `${-phase * 8}s` }} />
            ))}
            <svg className="absolute bottom-2 right-6 md:right-28" width={46} height={50} viewBox="0 0 48 52">
                <path d="M24 6 36 22h-6l9 12h-7l10 12H6l10-12H9l9-12h-6z" fill="#15803d" stroke="#bbf7d0" strokeWidth={1} />
                <rect x={21} y={46} width={6} height={6} fill="#7c2d12" />
                <circle cx={20} cy={24} r={1.8} fill={GOLD} />
                <circle cx={29} cy={33} r={1.8} fill="#fca5a5" />
                <circle cx={18} cy={40} r={1.8} fill={GOLD} />
                <circle cx={32} cy={42} r={1.8} fill="#ffffff" />
            </svg>
        </>
    );
}

export function FestiveBanner() {
    const theme = useFestive();
    const greeting = festiveGreeting(theme);
    if (!greeting) return null;
    return (
        <div className="relative h-24 w-full overflow-hidden text-white" style={{ background: 'var(--hero)' }}>
            {theme === 'republic' ? <NationalDay /> : null}
            {theme === 'independence' ? <NationalDay kites /> : null}
            {theme === 'diwali' ? <Diwali /> : null}
            {theme === 'eid' ? <Eid /> : null}
            {theme === 'christmas' ? <Christmas /> : null}
            <div className="container relative mx-auto flex h-full items-center px-6">
                <p className="text-2xl font-black tracking-tight md:text-3xl">{greeting}</p>
            </div>
        </div>
    );
}
