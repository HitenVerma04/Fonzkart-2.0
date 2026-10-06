"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { NotificationBell } from './NotificationBell';
import { 
    Search, 
    LogOut, 
    User, 
    Settings, 
    ChevronDown, 
    Activity, 
    Volume2, 
    VolumeX, 
    ShieldCheck, 
    ExternalLink, 
    Radio,
    Crown,
    Sparkles,
    CheckCircle2,
    LayoutDashboard
} from 'lucide-react';
import { useNotifications } from '../NotificationProvider';
import { logout } from '@/lib/session';
import { ThemeToggle } from '../theme-toggle';

function AudioAlertToggle() {
    const { audioEnabled, setAudioEnabled } = useNotifications();
    return (
        <button 
            type="button"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                audioEnabled 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shadow-xs' 
                    : 'bg-muted/50 text-muted-foreground border-border/60 hover:bg-muted'
            }`}
            title={audioEnabled ? 'Audio Alert Buzzer Active' : 'Audio Alert Buzzer Muted'}
        >
            <Activity className={`w-3.5 h-3.5 ${audioEnabled ? 'animate-pulse text-emerald-500' : ''}`} />
            <span className="hidden sm:inline">{audioEnabled ? 'Buzzer On' : 'Buzzer Off'}</span>
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>
    );
}

export function AdminHeader({ user }: { user?: { name: string; email: string; role: string } }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isPulsing, setIsPulsing] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside or pressing Escape
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const userInitial = user?.name?.charAt(0).toUpperCase() || 'A';
    const roleLabel = (user?.role || 'SUPER_ADMIN').replace(/_/g, ' ');

    return (
        <header className="h-16 border-b border-border/70 bg-background/85 dark:bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Left Area: Title / Context + Search Bar */}
            <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1 max-w-2xl">
                <Link 
                    href="/admin" 
                    className="flex items-center gap-2.5 group transition-opacity hover:opacity-85 shrink-0"
                    title="Admin Workspace Dashboard"
                >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform shadow-xs">
                        <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="hidden sm:flex flex-col leading-none">
                        <span className="font-black text-xs tracking-tight text-foreground">ADMIN WORKSPACE</span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase opacity-90">FonzKart Control</span>
                    </div>
                </Link>

                {/* Search Bar */}
                <div className="hidden md:block flex-1 max-w-md">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                        <input 
                            type="text"
                            placeholder="Search orders, inventory, customers..." 
                            className="w-full pl-9 pr-3 h-9 bg-muted/40 hover:bg-muted/60 focus:bg-background border border-border/70 focus:border-emerald-500/50 outline-none transition-all rounded-xl text-xs text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                </div>
            </div>
            
            {/* Right Area: Spaced Utility Controls + Super Admin Pop-up */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {/* Theme Toggle */}
                <ThemeToggle />
                
                {/* Audio Alert Toggle */}
                <AudioAlertToggle />
                
                {/* Test Alert Heartbeat Pulse Test Button */}
                <button 
                    type="button"
                    disabled={isPulsing}
                    onClick={async () => {
                        setIsPulsing(true);
                        try {
                            if (typeof Notification !== 'undefined') {
                                if (Notification.permission === 'granted') {
                                    new window.Notification("Verification Signal Sent!", {
                                        body: "Real-time sync pulse test successful.",
                                        icon: '/icon.png'
                                    });
                                }
                            }
                            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                            audio.play().catch(() => {});
                            const { sendPulseTest } = await import('@/actions/notifications');
                            await sendPulseTest();
                        } catch (e) {
                            console.error("Pulse test error:", e);
                        } finally {
                            setTimeout(() => setIsPulsing(false), 1200);
                        }
                    }}
                    title="Run Real-time Audio & Signal Pulse Test"
                    className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all shadow-xs ${
                        isPulsing 
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500 ring-2 ring-emerald-500/20'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                    }`}
                >
                    <Radio className={`w-3.5 h-3.5 text-emerald-500 ${isPulsing ? 'animate-ping' : ''}`} />
                    <span>{isPulsing ? 'Pulsing...' : 'Pulse Test'}</span>
                </button>

                {/* Notification Bell */}
                <NotificationBell />
                
                <div className="h-6 w-px bg-border/60 mx-0.5 sm:mx-1" />
                
                {/* Super Admin / User Pop-up Menu */}
                <div className="relative" ref={menuRef}>
                    <button 
                        type="button"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-expanded={isMenuOpen}
                        aria-haspopup="true"
                        aria-label="Open Super Admin menu"
                        className={`group flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-2xl border transition-all text-xs font-semibold outline-none ${
                            isMenuOpen 
                                ? 'bg-accent/80 border-emerald-500/60 ring-2 ring-emerald-500/20 shadow-md text-foreground' 
                                : 'border-border/70 bg-card/60 hover:bg-accent/60 text-foreground hover:border-emerald-500/30 shadow-xs'
                        }`}
                    >
                        <div className="relative shrink-0">
                            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 text-white flex items-center justify-center font-black text-xs shadow-xs ring-1 ring-white/20 group-hover:scale-105 transition-transform">
                                {userInitial}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background shadow-xs" title="Live Admin Session" />
                        </div>
                        <div className="flex flex-col items-start leading-none gap-0.5 text-left">
                            <div className="flex items-center gap-1">
                                <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                    {roleLabel}
                                </span>
                            </div>
                            <span className="text-xs font-bold text-foreground max-w-[110px] sm:max-w-[130px] truncate">
                                {user?.name || 'Super Admin'}
                            </span>
                        </div>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors ml-0.5">
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMenuOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''}`} />
                        </div>
                    </button>

                    <AnimatePresence>
                        {isMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                className="absolute right-0 mt-2.5 w-80 rounded-2xl border border-border/80 bg-background/98 dark:bg-zinc-950/95 backdrop-blur-2xl shadow-2xl p-2.5 z-50 text-foreground overflow-hidden"
                            >
                                {/* User Card Header */}
                                <div className="p-3.5 border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent dark:bg-zinc-900/50 rounded-xl mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 text-white flex items-center justify-center font-black text-base shadow-xs ring-1 ring-white/20 shrink-0">
                                            {userInitial}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-xs font-black text-foreground truncate">
                                                    {user?.name || 'Super Admin'}
                                                </p>
                                                <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                                            </div>
                                            {user?.email && (
                                                <p className="text-[11px] text-muted-foreground truncate font-mono">
                                                    {user.email}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                                    <Crown className="w-2.5 h-2.5 text-amber-500" />
                                                    {roleLabel}
                                                </span>
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-muted-foreground bg-muted/60">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    Active
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Navigation & Shortcuts */}
                                <div className="space-y-1 text-xs font-medium">
                                    <Link 
                                        href="/" 
                                        target="_blank"
                                        onClick={() => setIsMenuOpen(false)}
                                        className="flex items-center justify-between px-3 py-2 rounded-xl text-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <ExternalLink className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                            <span className="font-semibold">Live Storefront</span>
                                        </div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground group-hover:bg-emerald-500/15 group-hover:text-emerald-600">Store</span>
                                    </Link>

                                    <Link 
                                        href="/admin" 
                                        onClick={() => setIsMenuOpen(false)}
                                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-foreground hover:bg-accent transition-colors"
                                    >
                                        <LayoutDashboard className="w-4 h-4 text-primary shrink-0" />
                                        <span className="font-semibold">Admin Dashboard</span>
                                    </Link>

                                    <Link 
                                        href="/profile" 
                                        onClick={() => setIsMenuOpen(false)}
                                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-foreground hover:bg-accent transition-colors"
                                    >
                                        <User className="w-4 h-4 text-primary shrink-0" />
                                        <span className="font-semibold">My Profile & Security</span>
                                    </Link>

                                    <Link 
                                        href="/admin/admins" 
                                        onClick={() => setIsMenuOpen(false)}
                                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-foreground hover:bg-accent transition-colors"
                                    >
                                        <Settings className="w-4 h-4 text-primary shrink-0" />
                                        <span className="font-semibold">Manage Admins & Roles</span>
                                    </Link>
                                </div>

                                {/* Session Logout Form */}
                                <div className="pt-2 border-t border-border/60 mt-2">
                                    <form action={logout}>
                                        <button 
                                            type="submit"
                                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <LogOut className="w-4 h-4 shrink-0" />
                                                <span>Logout Session</span>
                                            </div>
                                            <span className="text-[10px] opacity-75 font-mono">Sign Out</span>
                                        </button>
                                    </form>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
}
