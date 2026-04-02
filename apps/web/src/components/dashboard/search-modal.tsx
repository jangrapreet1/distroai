"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { NavGroup } from "./sidebar";

interface SearchModalProps {
    open: boolean;
    onClose: () => void;
    navGroups: NavGroup[];
}

export function SearchModal({ open, onClose, navGroups }: SearchModalProps) {
    const router = useRouter();

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                // Toggle is handled by parent
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 p-4 border-b border-[var(--border)]">
                    <Search size={16} className="text-[var(--text-muted)]" />
                    <input autoFocus placeholder="Search pages, actions..." className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
                        onChange={(e) => {
                            const qEl = document.querySelectorAll('[data-search-item]');
                            qEl.forEach((el) => {
                                const match = el.textContent?.toLowerCase().includes(e.target.value.toLowerCase());
                                (el as HTMLElement).style.display = match || !e.target.value ? '' : 'none';
                            });
                        }}
                    />
                    <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)]">ESC</kbd>
                </div>
                <div className="max-h-72 overflow-y-auto py-2">
                    {navGroups.flatMap((g) => g.items).map((item) => (
                        <button key={item.href} data-search-item onClick={() => { router.push(item.href); onClose(); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition">
                            <item.icon size={16} /> {item.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
