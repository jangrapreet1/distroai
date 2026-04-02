"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

interface Notification {
    msg: string;
    t: string;
    color: string;
    href: string;
    ts: number;
}

export function NotificationBell({ notifications }: { notifications: Notification[] }) {
    const [notifOpen, setNotifOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        };
        if (notifOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [notifOpen]);

    const [lastReadTs, setLastReadTs] = useState(() => {
        if (typeof window === 'undefined') return 0;
        return Number(localStorage.getItem('notif-read-ts') || '0');
    });
    const unreadCount = useMemo(() => notifications.filter(n => n.ts > lastReadTs).length, [notifications, lastReadTs]);
    const markAllRead = () => {
        const now = Date.now();
        localStorage.setItem('notif-read-ts', String(now));
        setLastReadTs(now);
    };

    return (
        <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(!notifOpen)} className="relative text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--red)] text-[9px] flex items-center justify-center text-white font-bold">{unreadCount}</span>
                )}
            </button>
            {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-xl z-50">
                    <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
                        <span className="text-sm font-semibold">Notifications</span>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && <button onClick={markAllRead} className="text-[10px] text-[var(--gold)] hover:underline">Mark all read</button>}
                            <button onClick={() => setNotifOpen(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
                        </div>
                    </div>
                    {notifications.length > 0 ? notifications.map((n, i) => (
                        <Link key={i} href={n.href} onClick={() => setNotifOpen(false)}
                            className={`block p-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card-hover)] transition cursor-pointer ${n.ts > lastReadTs ? 'bg-[var(--gold)]/[0.03]' : ''}`}>
                            <p className="text-sm text-[var(--text-primary)]">{n.msg}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: n.color }}>{n.t}</p>
                        </Link>
                    )) : (
                        <div className="p-4 text-center text-sm text-[var(--text-muted)]">No notifications</div>
                    )}
                    <div className="p-2 text-center">
                        <Link href="/settings" onClick={() => setNotifOpen(false)} className="text-xs text-[var(--gold)] hover:underline">Notification Settings</Link>
                    </div>
                </div>
            )}
        </div>
    );
}
