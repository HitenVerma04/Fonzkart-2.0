"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';
import { getNotifications, markAsRead } from '@/actions/notifications';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    orderId?: string | null;
    isRead: boolean;
    createdAt: Date;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    refreshNotifications: () => Promise<void>;
    markRead: (id: string) => Promise<void>;
    audioEnabled: boolean;
    setAudioEnabled: (enabled: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ 
    children, 
    userId, 
    userRole,
    riderId
}: { 
    children: React.ReactNode; 
    userId?: string; 
    userRole?: string;
    riderId?: string;
}) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const unreadCount = notifications.filter(n => !n.isRead).length;

    const fetchNotifications = async () => {
        if (!userId && !riderId && !userRole) return;
        const res = await getNotifications(); // the server identifies the caller
        if (res.success && res.notifications) {
            setNotifications(res.notifications.map((n: any) => ({
                ...n,
                createdAt: new Date(n.createdAt)
            })));
        }
    };

    const [hasUnassigned, setHasUnassigned] = useState(false);
    const [buzzerActive, setBuzzerActive] = useState(false);
    const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);

    const playNotificationSound = (loop = false) => {
        if (!audioEnabled) return null;
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            if (loop) audio.loop = true;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.log("Audio play blocked by browser policy. User interaction required.", e);
                    setAudioEnabled(false);
                });
            }
            return audio;
        } catch (e) {
            console.error("Audio failed", e);
            return null;
        }
    };

    const checkUnassigned = async () => {
        if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN' && userRole !== 'ZONAL_HEAD') return;
        try {
            const res = await fetch('/api/admin/orders/unassigned-count');
            const data = await res.json();
            if (data.count > 0) {
                setHasUnassigned(true);
                // Auto-activate buzzer if audio was previously enabled
                if (!buzzerActive && audioEnabled) setBuzzerActive(true);
            } else {
                setHasUnassigned(false);
                setBuzzerActive(false);
            }
        } catch (e) {
            console.error("Failed to check unassigned orders", e);
        }
    };

    useEffect(() => {
        if (!userId && !riderId && !userRole) return;

        fetchNotifications();
        checkUnassigned();

        // Browser Permission Check (System Notifications)
        if (typeof window !== 'undefined' && typeof Notification !== 'undefined') {
            if (Notification.permission === 'default') {
                const timer = setTimeout(() => setShowPermissionPrompt(true), 2000);
                return () => clearTimeout(timer);
            }
        }

        // Live updates when Supabase Realtime is configured; otherwise the 30-second poll below is enough.
        const channel = supabaseClient
            ?.channel('notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'Notification',
                },
                (payload) => {
                    const newNotif = payload.new as any;
                    const isForMe = 
                        (newNotif.userId === userId) || 
                        (newNotif.riderId === riderId) ||
                        (newNotif.role === userRole) ||
                        (!newNotif.userId && !newNotif.role && !newNotif.riderId); 

                    if (isForMe) {
                        if (audioEnabled) playNotificationSound();
                        setNotifications(prev => [
                            { ...newNotif, createdAt: new Date(newNotif.createdAt) },
                            ...prev
                        ]);

                        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                            new window.Notification(newNotif.title, {
                                body: newNotif.message,
                                icon: '/icon.png',
                                badge: '/icon.png',
                                tag: newNotif.id,
                                renotify: true
                            } as any);
                        }
                        
                        if (newNotif.type === 'order_new') {
                           checkUnassigned();
                        }
                    }
                }
            )
            .subscribe();

        const pollTimer = setInterval(() => {
            fetchNotifications();
            checkUnassigned();
        }, 30000);

        return () => {
            if (supabaseClient && channel) supabaseClient.removeChannel(channel);
            clearInterval(pollTimer);
        };
    }, [userId, userRole, riderId, audioEnabled]);

    // Handle Buzzer Loop
    useEffect(() => {
        let audio: HTMLAudioElement | null = null;
        if (buzzerActive && hasUnassigned && audioEnabled) {
            audio = playNotificationSound(true);
        }
        return () => {
            if (audio) {
                audio.pause();
                audio.remove();
            }
        };
    }, [buzzerActive, hasUnassigned, audioEnabled]);

    const requestBrowserPermission = async () => {
        if (typeof Notification !== 'undefined') {
            const permission = await Notification.requestPermission();
            setShowPermissionPrompt(false);
            // This also helps unlock audio context if they click "Allow"
            if (!audioEnabled) {
                setAudioEnabled(true);
                setTimeout(() => playNotificationSound(), 100);
            }
        }
    };

    const markRead = async (id: string) => {
        const res = await markAsRead(id);
        if (res.success) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        }
    };

    return (
        <NotificationContext.Provider value={{ 
            notifications, 
            unreadCount, 
            refreshNotifications: fetchNotifications,
            markRead,
            audioEnabled,
            setAudioEnabled
        }}>
            {children}

            {/* Global Buzzer Indicator */}
            {buzzerActive && hasUnassigned && (
                <div className="fixed bottom-6 right-6 z-[100] animate-bounce">
                    <button 
                        onClick={() => setBuzzerActive(false)}
                        className="bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl font-black flex items-center gap-3 border-4 border-white dark:border-slate-900"
                    >
                       <div className="w-3 h-3 bg-white rounded-full animate-ping" />
                       NEW ORDER WAITING! STOP BUZZER
                    </button>
                </div>
            )}

            {/* Permission Prompt Modal */}
            {showPermissionPrompt && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-emerald-500/20 text-center animate-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-emerald-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Enable Alerts?</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                            Stay updated with real-time notifications for new orders and assignments even when the app is in the background.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={requestBrowserPermission}
                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
                            >
                                ALLOW NOTIFICATIONS
                            </button>
                            <button 
                                onClick={() => setShowPermissionPrompt(false)}
                                className="w-full py-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold text-xs uppercase tracking-widest transition-colors"
                            >
                                Not Now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotifications must be used within NotificationProvider');
    return context;
};
