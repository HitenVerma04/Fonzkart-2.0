'use client';

// The page transition, after the "add to cart" flight of the big shops: the page blurs behind a veil, the icon of what
// was tapped (Repair's wrench, Sell's tag, the Orders bag…) lifts off where it was and is tossed in an arc into the
// Fonzkart cart, which catches it with a bounce and a ripple while "Fonzkart" rises letter by letter under it. A slim
// green bar runs along the top as on GitHub or YouTube. The flight is timed from how long recent pages took to open;
// when the page is ready early everything plays faster, when it is late the cart waits gently, and once the page is
// there the cart rolls away and the veil lifts. Pages that are still loading (app/loading.tsx) keep it up.
// Only transforms and opacity are animated (Web Animations), and it is skipped on staff dashboards.
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Boxes, Briefcase, Home, Info, Package, Phone, Smartphone, User } from 'lucide-react';
import { FCartLogo } from '@/components/FCartLogo';
import { Wordmark } from '@/components/Wordmark';
import { ServiceGlyph, type ServiceGlyphName } from '@/components/ui/ServiceGlyph';
import { onPending, pendingCount, setNavListener } from './nav-events';

const STAFF = /^\/(admin|executive|partner|zonal|rm)(\/|$)/;
const SERVICES: ServiceGlyphName[] = ['sell', 'buy', 'repair', 'guard'];
const ROUTES: [RegExp, string][] = [
    [/^\/sell/, 'sell'],
    [/^\/buy/, 'buy'],
    [/^\/repair/, 'repair'],
    [/^\/screen-guard/, 'guard'],
    [/^\/(orders|pickup)/, 'orders'],
    [/^\/careers/, 'careers'],
    [/^\/(profile|login|signup|forgot-password|verify-email)/, 'account'],
    [/^\/bulk/, 'bulk'],
    [/^\/(about|how-it-works)/, 'info'],
    [/^\/contact/, 'contact'],
    [/^\/$/, 'home'],
];
const OTHER_GLYPHS = { orders: Package, careers: Briefcase, account: User, bulk: Boxes, info: Info, contact: Phone, home: Home, device: Smartphone };

const ESTIMATE_KEY = 'fz-nav-ms';
const TIMEOUT = 10000; // give up waiting for a page that never comes
const FAST = 2.4; // how much faster everything plays once the page is ready
const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
const OUT = 'cubic-bezier(.2,.8,.2,1)';
const TOSS = 'cubic-bezier(.45,0,.25,1)';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How long pages have been taking to open in this tab (a running average), in milliseconds. */
function estimate() {
    try {
        const v = Number(sessionStorage.getItem(ESTIMATE_KEY));
        return v > 0 ? v : 650;
    } catch {
        return 650;
    }
}
function remember(ms: number) {
    try {
        sessionStorage.setItem(ESTIMATE_KEY, String(Math.round(clamp(estimate() * 0.6 + ms * 0.4, 100, 4000))));
    } catch {
        /* private mode: keep the default */
    }
}

function isIconSized(el: Element) {
    const r = el.getBoundingClientRect();
    return r.width >= 10 && r.width <= 48 && r.height >= 10 && r.height <= 48;
}

interface Run {
    start: number;
    urlChanged: boolean;
    landed: boolean;
    leaving: boolean;
    fast: boolean;
    anims: Animation[];
    timers: number[];
}

export default function NavTransition() {
    const pathname = usePathname();
    const search = useSearchParams()?.toString() ?? '';
    const rootRef = useRef<HTMLDivElement>(null);
    const urlChanged = useRef<() => void>(() => {});
    const dismiss = useRef<() => void>(() => {});

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const q = (s: string) => root.querySelector(s) as HTMLElement;
        const veil = q('.fz-nav-veil');
        const bar = q('.fz-nav-bar');
        const cart = q('.fz-nav-cart');
        const body = q('.fz-nav-cart-body');
        const ring = q('.fz-nav-ring');
        const word = q('.fz-nav-word');
        const track = q('.fz-nav-track');
        const flyer = q('.fz-nav-flyer');
        const library = q('.fz-nav-lib');
        const trails = [...root.querySelectorAll<HTMLElement>('.fz-nav-trail')];
        const chars = [...word.querySelectorAll<HTMLElement>('.fz-ch > span')];
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        let run: Run | null = null;
        let press: { el: Element; x: number; y: number; t: number } | null = null;

        const play = (el: Element, frames: Keyframe[], options: KeyframeAnimationOptions) => {
            const a = el.animate(frames, { fill: 'both', ...options });
            if (run) {
                run.anims.push(a);
                if (run.fast) a.playbackRate = FAST;
            }
            return a;
        };

        /** The icon to fly: the service's own glyph, else the icon inside what was tapped, else one for the page. */
        const glyphFor = (path: string, el: Element | null) => {
            const name = ROUTES.find(([re]) => re.test(path))?.[1] ?? 'device';
            if (!SERVICES.includes(name as ServiceGlyphName) && el) {
                const own = [...el.querySelectorAll('svg')].find(isIconSized);
                if (own) {
                    const copy = own.cloneNode(true) as SVGElement;
                    copy.removeAttribute('class');
                    copy.removeAttribute('style');
                    copy.setAttribute('width', '26');
                    copy.setAttribute('height', '26');
                    return copy;
                }
            }
            return library.querySelector(`[data-g="${name}"] svg`)!.cloneNode(true);
        };

        /** Where the flight starts: the tapped icon, else the tapped control, else the finger. */
        const startPoint = (el: Element | null, x?: number, y?: number) => {
            if (el?.isConnected) {
                const icon = [...el.querySelectorAll('svg')].find(isIconSized);
                const r = (icon ?? el).getBoundingClientRect();
                if (icon || (r.width > 0 && r.width <= 280 && r.height <= 140)) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }
            if (x || y) return { x: x ?? 0, y: y ?? 0 };
            return { x: innerWidth / 2, y: innerHeight * 0.8 };
        };

        const reset = () => {
            run?.anims.forEach(a => a.cancel());
            run?.timers.forEach(clearTimeout);
            run = null;
            flyer.replaceChildren();
            root.dataset.on = '0';
            delete document.documentElement.dataset.fzNav;
        };

        const leave = (timedOut: boolean) => {
            const r = run;
            if (!r || r.leaving) return;
            r.leaving = true;
            r.fast = false;
            r.timers.forEach(clearTimeout);
            if (!timedOut) remember(performance.now() - r.start);
            const filled = new DOMMatrixReadOnly(getComputedStyle(bar).transform).a || 0;
            play(bar, [{ transform: `scaleX(${filled})`, opacity: 1 }, { transform: 'scaleX(1)', opacity: 1, offset: 0.55 }, { transform: 'scaleX(1)', opacity: 0 }], { duration: 420, easing: 'ease-out' });
            play(cart, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(96px)' }], { duration: 320, easing: 'cubic-bezier(.55,0,.8,.2)' });
            play(word, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 240, delay: 40, easing: 'ease-in' });
            play(track, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 });
            play(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 120, easing: 'ease-out' });
            window.setTimeout(() => {
                if (run === r) reset();
            }, 440);
        };

        /** Ends the transition once the new address is in and nothing is still loading; until the icon has landed it hurries. */
        const check = () => {
            const r = run;
            if (!r || r.leaving || !r.urlChanged || pendingCount() > 0) return;
            if (!r.landed) {
                if (!r.fast) {
                    r.fast = true;
                    r.anims.forEach(a => a.playState === 'running' && a.updatePlaybackRate(FAST));
                }
                return;
            }
            leave(false);
        };
        const checkAfterPaint = () => requestAnimationFrame(() => requestAnimationFrame(check));

        const land = (r: Run, at: { x: number; y: number }) => {
            play(flyer, [{ transform: `translate(${at.x}px, ${at.y}px) scale(.65)`, opacity: 1 }, { transform: `translate(${at.x}px, ${at.y + 22}px) scale(.2)`, opacity: 0 }], { duration: 200, easing: 'cubic-bezier(.55,0,1,.45)' });
            play(body, [{ transform: 'none' }, { transform: 'translateY(5px) scale(1.07,.9)', offset: 0.3 }, { transform: 'translateY(-4px) scale(.97,1.04)', offset: 0.62 }, { transform: 'none' }], { duration: 460, delay: 80, easing: 'ease-out' });
            play(ring, [{ opacity: 0.75, transform: 'scale(.35)' }, { opacity: 0, transform: 'scale(1.8)' }], { duration: 560, delay: 100, easing: OUT });
            play(track, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 280 });
            r.timers.push(
                window.setTimeout(() => {
                    if (run !== r || r.leaving) return;
                    r.landed = true;
                    // Waiting on a slow page: the cart breathes until it arrives.
                    play(cart, [{ transform: 'none' }, { transform: 'translateY(-5px)' }], { duration: 900, delay: 200, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
                    check();
                }, r.fast ? 150 : 280),
            );
        };

        const start = (href: string, el: Element | null, x?: number, y?: number) => {
            if (run) return;
            let url: URL;
            try {
                url = new URL(href, location.href);
            } catch {
                return;
            }
            if (url.origin !== location.origin) return;
            if (url.pathname === location.pathname && url.search === location.search) return;
            if (STAFF.test(location.pathname) || STAFF.test(url.pathname)) return;

            const r: Run = { start: performance.now(), urlChanged: false, landed: false, leaving: false, fast: false, anims: [], timers: [] };
            run = r;
            root.dataset.on = '1';
            document.documentElement.dataset.fzNav = '1';
            r.timers.push(window.setTimeout(() => leave(true), TIMEOUT));

            // Measured before anything moves: the basket's mouth.
            const box = body.getBoundingClientRect();
            const mouth = { x: box.left + box.width * 0.54, y: box.top + box.height * 0.3 };
            const flight = clamp(estimate() * 0.6, 360, 680);

            play(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
            play(bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(.28)', offset: 0.05 }, { transform: 'scaleX(.6)', offset: 0.2 }, { transform: 'scaleX(.82)', offset: 0.5 }, { transform: 'scaleX(.94)' }], { duration: 9000, easing: 'linear' });
            play(cart, [{ opacity: 0, transform: 'translateY(14px) scale(.86)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: SPRING });
            chars.forEach((c, i) => play(c, [{ transform: 'translateY(110%)' }, { transform: 'none' }], { duration: 420, delay: flight * 0.35 + i * 30, easing: OUT }));

            if (reduced.matches) {
                r.landed = true;
                play(track, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 200 });
                return;
            }

            flyer.replaceChildren(glyphFor(url.pathname, el));
            const from = startPoint(el, x, y);
            const dist = Math.hypot(mouth.x - from.x, mouth.y - from.y);
            const ctrl = { x: (from.x + mouth.x) / 2 + (mouth.x - from.x) * 0.1, y: Math.max(36, Math.min(from.y, mouth.y) - Math.max(110, dist * 0.38)) };
            const lean = mouth.x < from.x ? 14 : -14;
            const path: Keyframe[] = [];
            for (let i = 0, n = 18; i <= n; i++) {
                const k = i / n;
                const u = 1 - k;
                const px = u * u * from.x + 2 * u * k * ctrl.x + k * k * mouth.x;
                const py = u * u * from.y + 2 * u * k * ctrl.y + k * k * mouth.y;
                const scale = k < 0.22 ? 0.55 + (k / 0.22) * 0.6 : 1.15 - ((k - 0.22) / 0.78) * 0.5; // lifts off, then shrinks into the distance
                path.push({ transform: `translate(${px}px, ${py}px) rotate(${Math.sin(k * Math.PI) * lean}deg) scale(${scale})`, opacity: k < 0.1 ? k / 0.1 : 1, offset: k });
            }
            const toss = play(flyer, path, { duration: flight, easing: TOSS });
            trails.forEach((t, i) => play(t, path.map(f => ({ ...f, opacity: (f.opacity as number) * (i ? 0.22 : 0.4) })), { duration: flight, delay: 45 * (i + 1), easing: TOSS }));
            toss.finished.then(() => run === r && !r.leaving && land(r, mouth)).catch(() => {});
        };

        const onClick = (e: MouseEvent) => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
            if (!a || root.contains(a)) return;
            if ((a.target && a.target !== '_self') || a.hasAttribute('download') || 'noFly' in a.dataset) return;
            const href = a.getAttribute('href') ?? '';
            if (href.startsWith('#') || /^(mailto|tel|javascript|whatsapp):/i.test(href)) return;
            let url: URL;
            try {
                url = new URL(a.href);
            } catch {
                return;
            }
            if (url.pathname.startsWith('/api/') || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) return;
            start(url.href, a, e.clientX, e.clientY);
        };
        const onPress = (e: PointerEvent) => {
            press = { el: e.target as Element, x: e.clientX, y: e.clientY, t: performance.now() };
        };
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && run && leave(true);
        const onShow = (e: PageTransitionEvent) => e.persisted && reset();

        document.addEventListener('click', onClick, true);
        document.addEventListener('pointerdown', onPress, true);
        document.addEventListener('keydown', onKey);
        window.addEventListener('pageshow', onShow);
        const offNav = setNavListener(href => {
            const recent = press && performance.now() - press.t < 1500 ? press : null;
            const el = recent ? recent.el.closest('a, button, [role="button"]') ?? recent.el : null;
            start(href, el, recent?.x, recent?.y);
        });
        const offPending = onPending(checkAfterPaint);
        urlChanged.current = () => {
            if (run && !run.urlChanged) {
                run.urlChanged = true;
                checkAfterPaint();
            }
        };
        // A tap on the veil lets someone out of a page that is taking very long.
        dismiss.current = () => run && performance.now() - run.start > 1500 && leave(true);

        return () => {
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('pointerdown', onPress, true);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('pageshow', onShow);
            offNav();
            offPending();
            reset();
        };
    }, []);

    useEffect(() => {
        urlChanged.current();
    }, [pathname, search]);

    return (
        <div ref={rootRef} className="fz-nav" data-on="0" aria-hidden="true" onClick={() => dismiss.current()}>
            <div className="fz-nav-veil" />
            <div className="fz-nav-bar" />
            <div className="fz-nav-stage">
                <div className="fz-nav-cart">
                    <div className="fz-nav-cart-body">
                        <FCartLogo size={120} animate={false} />
                    </div>
                    <span className="fz-nav-ring" />
                </div>
                <Wordmark className="fz-nav-word" split />
                <div className="fz-nav-track" />
            </div>
            <span className="fz-nav-trail" />
            <span className="fz-nav-trail" />
            <div className="fz-nav-flyer" />
            <div className="fz-nav-lib">
                {SERVICES.map(n => (
                    <span key={n} data-g={n}>
                        <ServiceGlyph name={n} color="currentColor" size={26} />
                    </span>
                ))}
                {Object.entries(OTHER_GLYPHS).map(([n, Icon]) => (
                    <span key={n} data-g={n}>
                        <Icon size={26} strokeWidth={2} />
                    </span>
                ))}
            </div>
        </div>
    );
}
