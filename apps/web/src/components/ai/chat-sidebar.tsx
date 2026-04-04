"use client";

import { Sparkles, MessageSquare, X } from "lucide-react";
import type { ChatSession } from "./ai-types";

interface ChatSidebarProps {
    sessions: ChatSession[];
    activeSessionId: string | null;
    showHistoryMenu: boolean;
    onSelectSession: (id: string) => void;
    onNewChat: () => void;
    onCloseMenu: () => void;
}

export function ChatSidebar({ sessions, activeSessionId, showHistoryMenu, onSelectSession, onNewChat, onCloseMenu }: ChatSidebarProps) {
    return (
        <>
            {/* Mobile History Overlay */}
            {showHistoryMenu && (
                <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onCloseMenu} />
            )}

            {/* Left Panel */}
            <div className={`absolute lg:relative top-0 left-0 h-full z-50 flex flex-col w-72 border-r border-[var(--border)] bg-[var(--bg-secondary)] shrink-0 transition-transform duration-300 lg:translate-x-0 ${showHistoryMenu ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-4 border-b border-[var(--border)] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles size={20} className="text-[var(--purple)]" />
                            <h2 className="font-bold">DistroAI</h2>
                        </div>
                        <button onClick={onCloseMenu} className="lg:hidden p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
                            <X size={18} />
                        </button>
                    </div>
                    <button onClick={() => { onNewChat(); onCloseMenu(); }} className="flex items-center justify-center gap-2 w-full py-2.5 text-sm rounded-[var(--radius-md)] bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)]/20 transition font-medium border border-[var(--gold)]/20">
                        <MessageSquare size={16} /> New Chat
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {sessions.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)] px-3 py-4 text-center">Your chat history will appear here.</p>
                    ) : (
                        sessions.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => { onSelectSession(s.id); onCloseMenu(); }}
                                className={`w-full text-left px-3 py-2.5 text-sm rounded-[var(--radius-md)] transition truncate block ${activeSessionId === s.id ? 'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] font-medium shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/50 border border-transparent'}`}
                                title={s.title}
                            >
                                {s.title}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
