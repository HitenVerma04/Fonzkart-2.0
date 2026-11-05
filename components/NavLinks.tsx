'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    ChevronDown,
    Briefcase,
    Building2,
    ShieldCheck,
    Smartphone,
    Recycle,
    ArrowRight,
    HelpCircle,
    Info,
    Mail,
    Sparkles
} from 'lucide-react';

interface NavLinksSessionUser {
    id?: string | null;
    name?: string | null;
    role?: string | null;
}

export function NavLinks({ session, isAdminUser }: { session: { user?: NavLinksSessionUser } | null; isAdminUser: boolean }) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [prevPathname, setPrevPathname] = useState(pathname);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const triggerBtnRef = useRef<HTMLButtonElement>(null);

    const primaryLinks = [
        { href: '/sell', label: 'Check Price' },
        { href: '/screen-guard', label: 'Screen Guards' },
        { href: '/orders', label: 'My Orders' },
        {
            href: '/careers',
            label: 'Careers',
            badge: 'Hiring',
            badgePulse: true
        },
    ];

    if (session && isAdminUser) {
        primaryLinks.push({ href: '/admin', label: 'Admin Panel' });
    }

    // Reset dropdown on route change during render (React recommended pattern)
    if (prevPathname !== pathname) {
        setPrevPathname(pathname);
        if (isOpen) {
            setIsOpen(false);
        }
    }

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Handle ESC key for accessibility
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
                triggerBtnRef.current?.focus();
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    return (
        <nav aria-label="Main Navigation" className="flex items-center gap-1 sm:gap-2 md:gap-3">
            {primaryLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                            isActive
                                ? 'text-primary bg-primary/10 dark:bg-primary/20 font-semibold shadow-xs'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        <span>{link.label}</span>
                        {link.badge && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                {link.badgePulse && (
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                    </span>
                                )}
                                {link.badge}
                            </span>
                        )}
                        {isActive && !link.badge && (
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-4 bg-primary rounded-full" />
                        )}
                    </Link>
                );
            })}

            {/* Futuristic "View More" Megamenu Dropdown */}
            <div className="relative" ref={dropdownRef}>
                <button
                    ref={triggerBtnRef}
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    type="button"
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isOpen
                            ? 'text-foreground bg-accent'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                    }`}
                >
                    <span>View More</span>
                    <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 text-muted-foreground ${
                            isOpen ? 'rotate-180 text-foreground' : ''
                        }`}
                    />
                </button>

                {isOpen && (
                    <div
                        role="menu"
                        className="absolute right-0 mt-3 w-80 sm:w-[500px] md:w-[620px] rounded-3xl border border-border/60 bg-background/95 backdrop-blur-2xl p-5 sm:p-6 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Column 1: Company & Careers */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    <Building2 className="h-3.5 w-3.5 text-primary" />
                                    Company
                                </div>
                                <ul className="space-y-1">
                                    <li>
                                        <Link
                                            href="/about"
                                            className="group flex items-start gap-2.5 p-2 rounded-xl hover:bg-accent transition-colors"
                                        >
                                            <Info className="h-4 w-4 text-muted-foreground group-hover:text-primary mt-0.5 transition-colors" />
                                            <div>
                                                <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">About Us</div>
                                                <div className="text-[11px] text-muted-foreground leading-tight">Our story &amp; mission</div>
                                            </div>
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/how-it-works"
                                            className="group flex items-start gap-2.5 p-2 rounded-xl hover:bg-accent transition-colors"
                                        >
                                            <HelpCircle className="h-4 w-4 text-muted-foreground group-hover:text-primary mt-0.5 transition-colors" />
                                            <div>
                                                <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">How It Works</div>
                                                <div className="text-[11px] text-muted-foreground leading-tight">Instant quote &amp; pickup</div>
                                            </div>
                                        </Link>
                                    </li>
                                    {/* Prominently Highlighted Careers Link */}
                                    <li>
                                        <Link
                                            href="/careers"
                                            className="group flex items-start gap-2.5 p-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 transition-all shadow-xs"
                                        >
                                            <Briefcase className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300 group-hover:text-emerald-600">
                                                        Careers
                                                    </span>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500 text-white shadow-xs">
                                                        2 Openings
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 leading-tight mt-0.5">
                                                    Accountant &amp; Field Executive
                                                </div>
                                            </div>
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/contact"
                                            className="group flex items-start gap-2.5 p-2 rounded-xl hover:bg-accent transition-colors"
                                        >
                                            <Mail className="h-4 w-4 text-muted-foreground group-hover:text-primary mt-0.5 transition-colors" />
                                            <div>
                                                <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Contact Us</div>
                                                <div className="text-[11px] text-muted-foreground leading-tight">Get in touch with support</div>
                                            </div>
                                        </Link>
                                    </li>
                                </ul>
                            </div>

                            {/* Column 2: Gadget Services */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    <Smartphone className="h-3.5 w-3.5 text-primary" />
                                    Sell Devices
                                </div>
                                <ul className="space-y-1">
                                    <li>
                                        <Link
                                            href="/sell?category=smartphone"
                                            className="block px-2.5 py-1.5 rounded-lg text-sm text-foreground/80 hover:text-primary hover:bg-accent transition-colors"
                                        >
                                            Sell Smartphone
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/sell?category=tablet"
                                            className="block px-2.5 py-1.5 rounded-lg text-sm text-foreground/80 hover:text-primary hover:bg-accent transition-colors"
                                        >
                                            Sell Tablet
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/sell?category=laptop"
                                            className="block px-2.5 py-1.5 rounded-lg text-sm text-foreground/80 hover:text-primary hover:bg-accent transition-colors"
                                        >
                                            Sell Laptop
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/sell?category=console"
                                            className="block px-2.5 py-1.5 rounded-lg text-sm text-foreground/80 hover:text-primary hover:bg-accent transition-colors"
                                        >
                                            Sell Gaming Console
                                        </Link>
                                    </li>
                                    <li className="pt-1">
                                        <Link
                                            href="/contact?topic=bulk"
                                            className="flex items-center gap-2 p-2 rounded-xl bg-accent/60 hover:bg-accent text-xs font-medium text-foreground transition-colors"
                                        >
                                            <Recycle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                            <span>Bulk Orders &amp; Recycling</span>
                                        </Link>
                                    </li>
                                </ul>
                            </div>

                            {/* Column 3: Transparency & Policies */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                    Policies &amp; Info
                                </div>
                                <ul className="space-y-1 text-xs text-muted-foreground">
                                    <li>
                                        <Link href="/terms" className="block px-2 py-1 rounded hover:text-primary hover:bg-accent/60 transition-colors">
                                            Terms of Service
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/privacy" className="block px-2 py-1 rounded hover:text-primary hover:bg-accent/60 transition-colors">
                                            Privacy Policy
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/cancellation-policy" className="block px-2 py-1 rounded hover:text-primary hover:bg-accent/60 transition-colors">
                                            Cancellation Policy
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/refund-policy" className="block px-2 py-1 rounded hover:text-primary hover:bg-accent/60 transition-colors">
                                            Refund Policy
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/return-policy" className="block px-2 py-1 rounded hover:text-primary hover:bg-accent/60 transition-colors">
                                            Return &amp; Exchange
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/sitemap" className="block px-2 py-1 rounded hover:text-primary hover:bg-accent/60 transition-colors">
                                            Sitemap
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Bottom Bar in Megamenu */}
                        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                                Bangalore Doorstep Gadget Pickup
                            </span>
                            <Link href="/contact" className="font-semibold text-primary hover:underline inline-flex items-center gap-1">
                                Need Help? <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}

export default NavLinks;
