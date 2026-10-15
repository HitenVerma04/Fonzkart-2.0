'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    User,
    LogOut,
    Menu,
    Sparkles,
    Smartphone,
    Briefcase,
    ShoppingBag,
    ChevronDown,
    ShieldCheck,
    Settings,
    LayoutDashboard,
    ExternalLink
} from 'lucide-react';
import { NavLinks } from './NavLinks';
import { SidebarDrawer } from './SidebarDrawer';
import { logout } from '@/actions/session';

interface HeaderSessionUser {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
}

interface HeaderClientControlsProps {
    session: { user?: HeaderSessionUser } | null;
    isAdminUser: boolean;
}

export function HeaderClientControls({ session, isAdminUser }: HeaderClientControlsProps) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isAccountPopOpen, setIsAccountPopOpen] = useState(false);
    const accountPopRef = useRef<HTMLDivElement>(null);

    const handleCloseDrawer = useCallback(() => setIsDrawerOpen(false), []);

    // Close account pop-up on click outside or Escape
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (accountPopRef.current && !accountPopRef.current.contains(event.target as Node)) {
                setIsAccountPopOpen(false);
            }
        }
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                setIsAccountPopOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const userInitial = session?.user?.name?.charAt(0).toUpperCase() || 'U';
    const userRoleDisplay = session?.user?.role?.replace('_', ' ') || 'Member';

    return (
        <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* ----------------- MOBILE VIEW ICONS (lg:hidden) ----------------- */}
            <div className="flex lg:hidden items-center gap-1 sm:gap-1.5">
                {/* 1. Direct Sell / Check Price Quick Action */}
                <Link
                    href="/sell"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold text-xs shadow-xs hover:shadow-md transition-all active:scale-95"
                    aria-label="Sell Gadget / Check Price"
                >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>Sell</span>
                </Link>

                {/* 2. Direct Careers Icon Button with Hiring Pulse */}
                <Link
                    href="/careers"
                    className="relative p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Careers - We're Hiring"
                >
                    <Briefcase className="h-4 w-4" />
                    <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                </Link>

                {/* 3. Direct Orders Icon Button */}
                <Link
                    href="/orders"
                    className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="My Orders"
                >
                    <ShoppingBag className="h-4 w-4" />
                </Link>

                {/* 4. Direct Profile / Login Icon Button */}
                {session ? (
                    <button
                        type="button"
                        onClick={() => setIsAccountPopOpen(!isAccountPopOpen)}
                        className="p-1 rounded-full hover:bg-accent text-foreground transition-colors"
                        aria-label="User Account Menu"
                    >
                        <span className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs border border-primary/20">
                            {userInitial}
                        </span>
                    </button>
                ) : (
                    <Link
                        href="/login"
                        className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Login"
                    >
                        <User className="h-4 w-4" />
                    </Link>
                )}

                {/* 5. Mobile Menu Toggle for Full Navigation */}
                <button
                    type="button"
                    onClick={() => setIsDrawerOpen(true)}
                    aria-label="Open navigation sidebar"
                    aria-expanded={isDrawerOpen}
                    className="p-2 rounded-full text-foreground/80 hover:text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                >
                    <Menu className="h-5 w-5" />
                </button>
            </div>

            {/* ----------------- DESKTOP VIEW CONTROLS (hidden lg:flex) ----------------- */}
            <div className="hidden lg:flex items-center gap-2.5">
                <NavLinks session={session} isAdminUser={isAdminUser} />

                <div className="h-5 w-px bg-border/60 mx-1" />

                {/* Sell Gadget CTA Button */}
                <Link
                    href="/sell"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-emerald-600 to-green-600 dark:from-emerald-500 dark:to-green-500 text-white shadow-xs hover:shadow-md hover:shadow-green-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Sell Gadget</span>
                </Link>

                {/* User Profile / Pop-up Auth State */}
                {session ? (
                    <div className="relative" ref={accountPopRef}>
                        {/* Super Admin / User Profile Button (Opens Pop-up Panel) */}
                        <button
                            type="button"
                            onClick={() => setIsAccountPopOpen(!isAccountPopOpen)}
                            aria-expanded={isAccountPopOpen}
                            aria-haspopup="true"
                            className={`inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full border transition-all text-xs font-semibold ${
                                isAccountPopOpen
                                    ? 'bg-accent border-primary/50 ring-2 ring-primary/20 text-foreground'
                                    : 'border-border/70 bg-card/70 hover:bg-accent text-foreground hover:border-border shadow-2xs'
                            }`}
                        >
                            <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-extrabold text-[11px] shadow-xs">
                                {userInitial}
                            </span>
                            <span className="max-w-[110px] truncate">{session.user?.name || 'Account'}</span>
                            <ChevronDown
                                className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
                                    isAccountPopOpen ? 'rotate-180' : ''
                                }`}
                            />
                        </button>

                        {/* Interactive Pop-up Panel */}
                        {isAccountPopOpen && (
                            <div className="absolute right-0 mt-2.5 w-64 rounded-2xl border border-border/80 bg-background/98 backdrop-blur-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-foreground">
                                {/* User Info Header */}
                                <div className="p-3 border-b border-border/60 bg-muted/40 rounded-xl mb-1.5">
                                    <div className="flex items-center gap-2.5">
                                        <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                                            {userInitial}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-foreground truncate">
                                                {session.user?.name || 'User'}
                                            </p>
                                            {session.user?.email && (
                                                <p className="text-[11px] text-muted-foreground truncate">
                                                    {session.user.email}
                                                </p>
                                            )}
                                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                                {userRoleDisplay}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Menu Links */}
                                <div className="space-y-0.5 text-xs">
                                    {isAdminUser && (
                                        <Link
                                            href="/admin"
                                            onClick={() => setIsAccountPopOpen(false)}
                                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-foreground font-semibold hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                        >
                                            <LayoutDashboard className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                            <span>Admin Workspace</span>
                                        </Link>
                                    )}

                                    <Link
                                        href="/orders"
                                        onClick={() => setIsAccountPopOpen(false)}
                                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-foreground hover:bg-accent transition-colors"
                                    >
                                        <ShoppingBag className="h-4 w-4 text-primary shrink-0" />
                                        <span>My Orders</span>
                                    </Link>

                                    <Link
                                        href="/profile"
                                        onClick={() => setIsAccountPopOpen(false)}
                                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-foreground hover:bg-accent transition-colors"
                                    >
                                        <User className="h-4 w-4 text-primary shrink-0" />
                                        <span>Profile Settings</span>
                                    </Link>
                                </div>

                                {/* Logout Action inside Pop-up */}
                                <div className="pt-1.5 border-t border-border/60 mt-1.5">
                                    <form action={logout}>
                                        <button
                                            type="submit"
                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors"
                                        >
                                            <LogOut className="h-4 w-4 shrink-0" />
                                            <span>Log Out</span>
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 hover:bg-accent px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors shadow-2xs"
                    >
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Login</span>
                    </Link>
                )}

                {/* Desktop Menu Trigger */}
                <button
                    type="button"
                    onClick={() => setIsDrawerOpen(true)}
                    aria-label="Open navigation sidebar"
                    aria-expanded={isDrawerOpen}
                    className="p-2 rounded-full text-foreground/80 hover:text-foreground hover:bg-accent/80 border border-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                >
                    <Menu className="h-5 w-5" />
                </button>
            </div>

            {/* Slide-out Navigation Drawer */}
            <SidebarDrawer
                isOpen={isDrawerOpen}
                onClose={handleCloseDrawer}
                session={session}
                isAdminUser={isAdminUser}
            />
        </div>
    );
}

export default HeaderClientControls;
