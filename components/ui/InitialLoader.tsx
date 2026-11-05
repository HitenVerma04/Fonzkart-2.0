'use client';

// The launch animation, the same idea as the Customer app's: on a themed sky the F logo appears, the ONZKA₹T lettering is
// unveiled under it, and the five services click round it like a precision dial, each one's moment lighting it up with
// its name under the logo. Then the sky fades and each icon flies to its link on the page. It plays once per tab, a tap
// skips it, and the page is already there underneath. Only transforms and opacity change, written once per frame.
import { useEffect, useRef, useState } from 'react';
import { Headphones, Laptop, Smartphone, Tablet, Watch } from 'lucide-react';
import { festiveGreeting } from '@/lib/festive';
import { useFestive } from '@/components/festive/festive-client';
import { ServiceGlyph, type ServiceGlyphName } from './ServiceGlyph';

// In the order the dial shows them, with the links they fly to.
const SERVICES: { id: ServiceGlyphName; word: string; target: string }[] = [
    { id: 'sell', word: 'Sell', target: 'a[href^="/sell"]' },
    { id: 'buy', word: 'Buy', target: 'a[href^="/buy"], a[href^="/orders"]' },
    { id: 'repair', word: 'Repair', target: 'a[href^="/repair"]' },
    { id: 'guard', word: 'Screen Guard', target: 'a[href^="/screen-guard"]' },
    { id: 'refurbish', word: 'Refurbish', target: 'a[href^="/orders"]' },
];
const COUNT = SERVICES.length;
const DEVICES = [
    { Icon: Smartphone, x: 10, y: 10, size: 34, delay: 0 }, { Icon: Laptop, x: 82, y: 8, size: 38, delay: -1.3 }, { Icon: Watch, x: 8, y: 86, size: 30, delay: -2.4 },
    { Icon: Tablet, x: 84, y: 88, size: 36, delay: -3.6 }, { Icon: Headphones, x: 50, y: 92, size: 30, delay: -4.8 },
];

const TILT = 1.34; // the ring's height against its width: tall, which keeps the logo in the middle clear
const LEAN = -0.1; // the ring's slant, in radians
const BEAT = 560; // one click of the dial, in milliseconds
const MOVE = 0.6; // the share of a beat spent moving; the rest is the service's moment
const SPOTLIGHT = 0.5; // how much larger the lit service grows
const FRONT = Math.PI / 2; // the lit position: the bottom of the ring
const SPIN_START = 800;
const SHOW = SPIN_START + BEAT * COUNT; // one full round
const FADE = 560;
const STAGGER = 70;
const FLIGHT = 680;
const LANDED = 360;
const PHONE = 190 / 1408; // share of the wordmark's width taken by the F-phone, which is shown from the start
const LANDING_SCALE = 0.72;
const SMEARS = [[0.009, 0.04], [0.006, 0.065], [0.003, 0.09]];
const TRAILS = [0.05, 0.1, 0.16];
const TAU = Math.PI * 2;

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const outCubic = (t: number) => 1 - (1 - t) ** 3;
const inOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const inOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const backOut = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

function place(angle: number, radius: number) {
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * TILT;
    return { x: x * Math.cos(LEAN) - y * Math.sin(LEAN), y: x * Math.sin(LEAN) + y * Math.cos(LEAN), depth: Math.sin(angle) };
}

/** How far through the current click: 0 at a stop, surging to 1 at the next one. */
function click(spin: number) {
    const beats = spin * COUNT;
    return inOutCubic(Math.min(1, (beats - Math.floor(beats)) / MOVE));
}

/** The dial's turn for `spin` (0 to 1 is one round), moving in clicks. */
const dial = (spin: number) => (-(Math.floor(spin * COUNT) + click(spin)) / COUNT) * TAU;

/** 1 while the service at `offset` is at the lit position, fading to 0 half a click away. */
function lit(spin: number, offset: number) {
    const a = dial(spin) + offset;
    const c = Math.max(0, 1 - Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) / (Math.PI / COUNT));
    return c * c * (3 - 2 * c);
}

/** How long ago (in beats) the service at `index` reached the lit position. */
function since(spin: number, index: number) {
    const u = (spin * COUNT - index + 1 - MOVE) % COUNT;
    return u < 0 ? u + COUNT : u;
}

/** Same numbers on every load, so the sky is designed rather than random (and the server and browser agree). */
function scatter(seed: number) {
    const x = Math.sin(seed * 127.1) * 43758.5453;
    return x - Math.floor(x);
}

const STARS = [0, 1, 2].map(layer => Array.from({ length: 10 }, (_, i) => {
    const seed = layer * 17 + i + 1;
    return { left: `${(scatter(seed) * 100).toFixed(2)}%`, top: `${(scatter(seed + 41) * 100).toFixed(2)}%`, size: Number((1.5 + scatter(seed + 83) * 2.5).toFixed(2)) };
}));

/** The middle of the first visible link matching `selector`, relative to the dial's centre; below the screen if none. */
function landingSpot(selector: string, cx: number, cy: number) {
    for (const link of document.querySelectorAll(selector)) {
        if (link.closest('.fz-boot')) continue;
        const box = link.getBoundingClientRect();
        if (box.width && box.height && box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth) {
            return { x: box.left + box.width / 2 - cx, y: box.top + box.height / 2 - cy };
        }
    }
    return { x: 0, y: innerHeight - cy + 56 };
}

export default function InitialLoader() {
    const root = useRef<HTMLDivElement>(null);
    const [done, setDone] = useState(false);
    const greeting = festiveGreeting(useFestive());

    useEffect(() => {
        const el = root.current;
        if (!el || document.documentElement.classList.contains('fz-booted')) {
            setDone(true);
            return undefined;
        }
        try {
            sessionStorage.setItem('fz-boot', '1');
        } catch { /* it plays again on the next load */ }

        const all = <T extends HTMLElement>(selector: string) => [...el.querySelectorAll<T>(selector)];
        const one = (selector: string) => el.querySelector<HTMLElement>(selector)!;
        const stack = one('.fz-boot-stack');
        const ring = one('.fz-boot-ring');
        const shock = one('.fz-boot-shock');
        const windowOuter = one('[data-reveal]');
        const letters = one('.fz-boot-letters');
        const light = one('.fz-boot-light');
        const backdrop = one('.fz-boot-backdrop');
        const words = all('[data-word]');
        const tiles = all('.fz-boot-tile');
        const auras = all('.fz-boot-aura');
        const pulses = all('.fz-boot-pulse');
        const litDiscs = all('.fz-boot-disc.lit');
        const smears = all('.fz-boot-smear');
        const trails = all('.fz-boot-trail');
        const waves = all('.fz-boot-wave');

        const radius = Math.min(innerWidth * 0.365, 180, innerHeight * 0.29);
        const cx = innerWidth / 2;
        const cy = innerHeight * 0.46;
        let exitAt = SHOW;
        let spots: { x: number; y: number }[] | null = null;
        let frame = 0;
        let start = 0;
        let now = 0;

        const skip = () => {
            exitAt = Math.min(exitAt, now);
        };
        el.addEventListener('click', skip);

        const draw = (time: number) => {
            start ||= time;
            now = time - start;
            const t = now;
            const spin = clamp((t - SPIN_START) / (BEAT * COUNT));
            const exit = inOutQuad(clamp((t - exitAt) / FADE));
            const logo = backOut(clamp((t - 120) / 760));
            if (t >= exitAt && !spots) {
                spots = SERVICES.map(s => landingSpot(s.target, cx, cy));
                el.style.pointerEvents = 'none';
            }

            backdrop.style.opacity = String(1 - exit);
            stack.style.opacity = String(Math.min(clamp(logo), 1) * (1 - exit));
            stack.style.transform = `translate(-50%, -50%) scale(${(0.72 + logo * 0.28) * (1 + Math.sin(click(spin) * Math.PI) * 0.014) * (1 + exit * 0.3)})`;
            ring.style.opacity = String(clamp(logo) * 0.55 * (1 - exit));
            const burst = outCubic(clamp((t - 220) / 1050));
            shock.style.opacity = String(burst > 0 ? (1 - burst) * 0.35 : 0);
            shock.style.transform = `scale(${0.4 + burst * 1.5})`;
            // The window slides left and the lettering right by the same amount: it stays put while being uncovered.
            const hidden = (1 - outCubic(clamp((t - 460) / 680))) * (1 - PHONE) * 100;
            windowOuter.style.transform = `translateX(${-hidden}%)`;
            letters.style.transform = `translateX(${hidden}%)`;
            const sweep = inOutQuad(clamp((t - 1180) / 720));
            light.style.opacity = sweep < 1 && sweep > 0 ? '1' : '0';
            light.style.transform = `translateX(${-140 + sweep * 500}%)`;

            for (let i = 0; i < COUNT; i += 1) {
                const offset = (i / COUNT) * TAU;
                const on = lit(spin, offset);
                words[i].style.opacity = String(spin > 0 ? on : 0);
                words[i].style.transform = `translateY(${(1 - on) * 7}px)`;

                const s = outCubic(clamp((t - 180 - i * 70) / 720));
                const start = t - exitAt - i * STAGGER;
                const f = spots ? inOutCubic(clamp(start / FLIGHT)) : 0;
                const spot = spots?.[i] ?? { x: 0, y: 0 };
                const at = place(FRONT + dial(spin) + offset - (1 - s) * 0.5, radius * (0.82 + s * 0.18 + on * 0.08));
                const near = (at.depth + 1) / 2;
                const age = since(spin, i);
                const pop = spin > 0 && age < 0.55 ? Math.sin((age / 0.55) * Math.PI) * 0.1 : 0;
                const hop = Math.sin(f * Math.PI) * 54;
                tiles[i].style.opacity = String(s * (0.5 + near * 0.22 + on * 0.28) * (1 - f) + f * (f > 0.93 ? (1 - f) / 0.07 : 1));
                tiles[i].style.transform = `translate(${at.x * (1 - f) + spot.x * f}px, ${at.y * (1 - f) + spot.y * f - hop}px) scale(${(0.74 + near * 0.2 + on * SPOTLIGHT + pop) * (1 - f) + LANDING_SCALE * f})`;
                const fill = String(on * Math.max(0, 1 - f * 4));
                auras[i].style.opacity = fill;
                litDiscs[i].style.opacity = fill;

                const p = age / 0.95;
                const pulsing = spin > 0 && p < 1 && f === 0;
                pulses[i].style.opacity = String(pulsing ? (1 - p) * 0.7 : 0);
                pulses[i].style.transform = `scale(${1 + p * 0.85})`;

                SMEARS.forEach(([lag, strength], n) => {
                    const smear = smears[i * SMEARS.length + n];
                    const ghost = place(FRONT + dial(spin + 1 - lag) + offset - (1 - s) * 0.5, radius * (0.82 + s * 0.18));
                    smear.style.opacity = String(strength * s * Math.max(0, 1 - f * 6));
                    smear.style.transform = `translate(${ghost.x}px, ${ghost.y}px) scale(${0.78 + ((ghost.depth + 1) / 2) * 0.26})`;
                });
                TRAILS.forEach((lag, n) => {
                    const star = trails[i * TRAILS.length + n];
                    const g = Math.max(0, f - lag);
                    star.style.opacity = String(g > 0 && g < 0.97 ? Math.sin(g * Math.PI) * (1 - lag * 3.5) : 0);
                    star.style.transform = `translate(${at.x * (1 - g) + spot.x * g}px, ${at.y * (1 - g) + spot.y * g - Math.sin(g * Math.PI) * 54}px) scale(${1 - lag * 3})`;
                });
                const ripple = spots ? outCubic(clamp((start - FLIGHT + 60) / LANDED)) : 0;
                waves[i].style.opacity = String(ripple > 0 ? (1 - ripple) * 0.85 : 0);
                waves[i].style.transform = `translate(${spot.x}px, ${spot.y}px) scale(${0.3 + ripple * 1.15})`;
            }

            if (t > exitAt + STAGGER * (COUNT - 1) + FLIGHT + LANDED) setDone(true);
            else frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(frame);
            el.removeEventListener('click', skip);
        };
    }, []);

    if (done) return null;
    return (
        <div ref={root} className="fz-boot" aria-hidden="true">
            <div className="fz-boot-backdrop absolute inset-0">
                <div className="absolute inset-0 bg-background" />
                <div className="fz-boot-sky" />
                <div className="fz-boot-aurora a" />
                <div className="fz-boot-aurora b" />
                {DEVICES.map(({ Icon, x, y, size, delay }) => (
                    <span key={x} className="fz-boot-device" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }}><Icon size={size} strokeWidth={1.3} /></span>
                ))}
                {STARS.map((stars, layer) => (
                    <div key={layer} className="fz-boot-stars" style={{ animationDelay: `${layer * -0.9}s` }}>
                        {stars.map(s => <i key={s.left} style={{ left: s.left, top: s.top, width: s.size, height: s.size }} />)}
                    </div>
                ))}
            </div>
            <div className="fz-boot-center">
                <div className="fz-boot-halo" />
                <div className="fz-boot-ring" />
                <div className="fz-boot-shock" />
                <div className="fz-boot-stack">
                    <div className="fz-boot-mark">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/brand/fonzkart_f_mark.png" alt="" />
                    </div>
                    <div className="fz-boot-window">
                        <div data-reveal>
                            <div className="fz-boot-letters">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/brand/fonzkart_wordmark.png" alt="" className="dark:hidden" />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/brand/fonzkart_wordmark_dark.png" alt="" className="hidden dark:block" />
                                <div className="fz-boot-light" />
                            </div>
                        </div>
                    </div>
                    <div className="fz-boot-words">
                        {SERVICES.map(s => <span key={s.id} data-word>{s.word}</span>)}
                    </div>
                    {greeting ? <div className="fz-boot-greeting">{greeting}</div> : null}
                </div>
                {SERVICES.map(s => (
                    <div key={s.id}>
                        <div className="fz-boot-wave" />
                        {TRAILS.map(lag => <div key={lag} className="fz-boot-trail" />)}
                        {SMEARS.map(([lag]) => <div key={lag} className="fz-boot-smear" />)}
                        <div className="fz-boot-tile">
                            <div className="fz-boot-aura" />
                            <div className="fz-boot-pulse" />
                            <div className="fz-boot-disc"><ServiceGlyph name={s.id} color="currentColor" size={28} /></div>
                            <div className="fz-boot-disc lit"><ServiceGlyph name={s.id} color="currentColor" size={28} /></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
