'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    X,
    Briefcase,
    Smartphone,
    ShoppingBag,
    Mail,
    Phone,
    ShieldCheck,
    Recycle,
    ArrowRight,
    Sparkles,
    LogOut,
    Home,
    MapPin
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { logout } from '@/actions/session';

interface SidebarSessionUser {
    id?: string | null;
    name?: string | null;
    role?: string | null;
}

interface SidebarDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    session?: { user?: SidebarSessionUser } | null;
    isAdminUser?: boolean;
}

const emptySubscribe = () => () => {};

export function SidebarDrawer({ isOpen, onClose, session, isAdminUser }: SidebarDrawerProps) {
    const pathname = usePathname();
    const mounted = useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false
    );
    const closeBtnRef = useRef<HTMLButtonElement>(null);
    const pathnameRef = useRef(pathname);

    // Auto-close ONLY when user navigates to a new page (pathname changes)
    useEffect(() => {
        if (pathnameRef.current !== pathname) {
            pathnameRef.current = pathname;
            if (isOpen) {
                onClose();
            }
        }
    }, [pathname, isOpen, onClose]);

    // Handle ESC key and backdrop scroll lock
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        const timer = setTimeout(() => {
            closeBtnRef.current?.focus();
        }, 100);

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            clearTimeout(timer);
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !mounted) return null;

    const drawerContent = (
        <div
            className="fixed inset-0 z-[9999] flex justify-end"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
        >
            {/* Backdrop Blur Overlay */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Slide-out Drawer Panel */}
            <div
                className="relative z-10 flex h-full w-full max-w-sm flex-col bg-background/98 backdrop-blur-2xl border-l border-border/60 shadow-2xl transition-transform duration-300 ease-out animate-in slide-in-from-right text-foreground overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drawer Header */}
                <div className="shrink-0 z-20 flex items-center justify-between border-b border-border/40 bg-background/90 px-6 py-4 backdrop-blur-md">
                    <Link href="/" onClick={onClose} className="flex items-center gap-2" aria-label="Fonzkart Home">
                        <Logo className="h-9 w-auto" />
                    </Link>
                    <button
                        ref={closeBtnRef}
                        onClick={onClose}
                        type="button"
                        className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                        aria-label="Close navigation menu"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Drawer Body Content - Scrollable */}
                <div className="flex-1 px-6 py-6 space-y-7 overflow-y-auto overscroll-contain">
                    {/* User Quick Info */}
                    {session ? (
                        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-accent/40 border border-border/40">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                                    {session.user?.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div className="leading-tight">
                                    <p className="text-xs text-muted-foreground">Logged in as</p>
                                    <p className="text-sm font-semibold text-foreground truncate max-w-[140px]">
                                        {session.user?.name}
                                    </p>
                                </div>
                            </div>
                            <form action={logout}>
                                <button
                                    type="submit"
                                    className="text-xs font-medium text-muted-foreground hover:text-destructive flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                                >
                                    <LogOut className="h-3.5 w-3.5" />
                                    Logout
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Link
                                href="/login"
                                onClick={onClose}
                                className="flex-1 text-center rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                            >
                                Login
                            </Link>
                            <Link
                                href="/signup"
                                onClick={onClose}
                                className="flex-1 text-center rounded-xl border border-input bg-card py-2.5 text-sm font-semibold hover:bg-accent transition-colors"
                            >
                                Sign Up
                            </Link>
                        </div>
                    )}

                    {/* Quick CTA: Sell Smartphone */}
                    <div>
                        <Link
                            href="/sell"
                            onClick={onClose}
                            className="group relative flex items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 dark:from-emerald-500 dark:to-green-500 px-5 py-4 text-white shadow-lg shadow-green-600/20 hover:shadow-xl hover:shadow-green-600/30 transition-all duration-300"
                        >
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-green-100">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Instant Quote
                                </div>
                                <div className="text-base font-bold">Sell Your Old Gadget</div>
                                <div className="text-xs text-green-100/90">Free Doorstep Pickup &amp; Spot Payment</div>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                <ArrowRight className="h-4 w-4 text-white" />
                            </div>
                        </Link>
                    </div>

                    {/* Careers Highlight Banner */}
                    <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                We&apos;re Hiring
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground">Bangalore HQ</span>
                        </div>
                        <h3 className="font-bold text-sm text-foreground mb-1">
                            Join Team FonzKart
                        </h3>
                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                            Actively hiring for <strong className="text-foreground">Accountant</strong> &amp; <strong className="text-foreground">Field Executive</strong> roles.
                        </p>
                        <Link
                            href="/careers"
                            onClick={onClose}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                        >
                            Explore Open Positions
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    {/* Main Navigation Links */}
                    <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">
                            Navigation
                        </p>
                        <Link
                            href="/"
                            onClick={onClose}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                pathname === '/' ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-accent'
                            }`}
                        >
                            <Home className="h-4 w-4 text-muted-foreground" />
                            Home
                        </Link>
                        <Link
                            href="/sell"
                            onClick={onClose}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                pathname === '/sell' ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-accent'
                            }`}
                        >
                            <Smartphone className="h-4 w-4 text-muted-foreground" />
                            Sell Smartphone / Check Price
                        </Link>
                        <Link
                            href="/orders"
                            onClick={onClose}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                pathname === '/orders' ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-accent'
                            }`}
                        >
                            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                            My Orders
                        </Link>
                        {session && isAdminUser && (
                            <Link
                                href="/admin"
                                onClick={onClose}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                            >
                                <ShieldCheck className="h-4 w-4" />
                                Admin Panel
                            </Link>
                        )}
                        <Link
                            href="/careers"
                            onClick={onClose}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                pathname === '/careers' ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-accent'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <Briefcase className="h-4 w-4 text-muted-foreground" />
                                Careers
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                2 Openings
                            </span>
                        </Link>
                    </div>

                    {/* Services Section */}
                    <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">
                            Sell Gadgets
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                            <Link
                                href="/sell?category=smartphone"
                                onClick={onClose}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Smartphone className="h-3.5 w-3.5 text-primary" />
                                Smartphones
                            </Link>
                            <Link
                                href="/sell?category=tablet"
                                onClick={onClose}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Smartphone className="h-3.5 w-3.5 text-primary" />
                                Tablets
                            </Link>
                            <Link
                                href="/sell?category=laptop"
                                onClick={onClose}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Smartphone className="h-3.5 w-3.5 text-primary" />
                                Laptops
                            </Link>
                            <Link
                                href="/sell?category=console"
                                onClick={onClose}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Smartphone className="h-3.5 w-3.5 text-primary" />
                                Consoles
                            </Link>
                        </div>
                        <Link
                            href="/contact?topic=bulk"
                            onClick={onClose}
                            className="flex items-center gap-2 px-3 py-2 mt-1 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                        >
                            <Recycle className="h-3.5 w-3.5 shrink-0" />
                            Bulk Corporate Orders &amp; Recycling
                        </Link>
                    </div>

                    {/* Company & Support */}
                    <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">
                            Company &amp; Legal
                        </p>
                        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                            <Link href="/about" onClick={onClose} className="px-3 py-1.5 hover:text-primary transition-colors">About Us</Link>
                            <Link href="/how-it-works" onClick={onClose} className="px-3 py-1.5 hover:text-primary transition-colors">How It Works</Link>
                            <Link href="/contact" onClick={onClose} className="px-3 py-1.5 hover:text-primary transition-colors">Contact Us</Link>
                            <Link href="/careers" onClick={onClose} className="px-3 py-1.5 hover:text-primary transition-colors font-medium text-primary">Careers</Link>
                            <Link href="/privacy" onClick={onClose} className="px-3 py-1.5 hover:text-primary transition-colors">Privacy Policy</Link>
                            <Link href="/terms" onClick={onClose} className="px-3 py-1.5 hover:text-primary transition-colors">Terms of Service</Link>
                        </div>
                    </div>

                    {/* Direct Contact / Support Info */}
                    <div className="rounded-2xl border border-border/60 bg-card/60 p-4 space-y-2.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2.5 text-foreground font-medium">
                            <Phone className="h-4 w-4 text-primary shrink-0" />
                            <span>+91 90603 36060</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-foreground font-medium">
                            <Mail className="h-4 w-4 text-primary shrink-0" />
                            <span>connect@fonzkart.in</span>
                        </div>
                        <div className="flex items-start gap-2.5 pt-1">
                            <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span className="leading-tight">#69 8th cross Hegde Nagar, SRK Nagar Post, Bangalore - 560077</span>
                        </div>
                    </div>
                </div>

                {/* Sticky Drawer Footer */}
                <div className="shrink-0 border-t border-border/60 p-4 bg-background/95 backdrop-blur-xl flex items-center justify-between shadow-xs">
                    <p className="text-[11px] font-medium text-muted-foreground leading-tight max-w-[210px]">
                        © {new Date().getFullYear()} NR Waste Management Private Limited
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-xs font-bold text-primary hover:underline px-2.5 py-1.5 rounded-lg hover:bg-primary/10 transition-colors flex items-center gap-1"
                        aria-label="Close navigation menu"
                    >
                        <span>Close</span>
                        <span className="text-sm font-light">×</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(drawerContent, document.body);
}

export default SidebarDrawer;
