"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { Send, Mic, MicOff, Square, ImagePlus, X, ScanLine, Plus, Command, ChevronRight } from "lucide-react";
import type { SlashCommand } from "./ai-types";
import { SLASH_COMMANDS } from "./ai-types";

interface ChatInputProps {
    input: string;
    onInputChange: (val: string) => void;
    onSend: (text: string) => void;
    isStreaming: boolean;
    imagePreview: string | null;
    imageBase64: string | null;
    onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClearImage: () => void;
    onToggleRecording: () => void;
    isRecording: boolean;
    onShowScanner: () => void;
}

export function ChatInput({
    input, onInputChange, onSend, isStreaming,
    imagePreview, imageBase64, onImageSelect, onClearImage,
    onToggleRecording, isRecording, onShowScanner,
}: ChatInputProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const paletteRef = useRef<HTMLDivElement>(null);
    const attachMenuRef = useRef<HTMLDivElement>(null);

    const [showPalette, setShowPalette] = useState(false);
    const [paletteIndex, setPaletteIndex] = useState(0);
    const [showAttachMenu, setShowAttachMenu] = useState(false);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) setShowPalette(false);
            if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) setShowAttachMenu(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredCommands = useMemo(() => {
        if (!input.startsWith('/')) return [];
        const search = input.toLowerCase();
        const all: { command: string; label: string; description: string; icon: any; prompt: string }[] = [];
        for (const cmd of SLASH_COMMANDS) {
            if (cmd.subCommands) {
                for (const sub of cmd.subCommands) {
                    all.push({ command: sub.command, label: `${cmd.label} → ${sub.label}`, description: cmd.description, icon: cmd.icon, prompt: sub.prompt });
                }
            } else {
                all.push(cmd);
            }
        }
        return all.filter(c => c.command.startsWith(search) || c.label.toLowerCase().includes(search.replace('/', '')));
    }, [input]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        onInputChange(val);
        if (val.startsWith('/') && val.length >= 1) {
            setShowPalette(true);
            setPaletteIndex(0);
        } else {
            setShowPalette(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showPalette && filteredCommands.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setPaletteIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setPaletteIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const selected = filteredCommands[paletteIndex];
                setShowPalette(false);
                onInputChange('');
                onSend(selected.prompt);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowPalette(false);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                const selected = filteredCommands[paletteIndex];
                onInputChange(selected.command + ' ');
            }
        } else {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend(input);
            }
        }
    };

    return (
        <div className="p-4 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
            <div className="max-w-4xl mx-auto relative flex items-end gap-2">
                <div className="flex-1 relative">
                    {/* Attached Image Preview */}
                    {imagePreview && (
                        <div className="absolute left-3 bottom-full mb-2 bg-[#111] border border-[var(--border)] rounded-lg p-1.5 shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2">
                            <img src={imagePreview} alt="Attached" className="h-12 w-12 rounded object-cover border border-[#222]" />
                            <button onClick={onClearImage} className="p-1 text-[var(--text-muted)] hover:text-red-400 bg-white/5 hover:bg-white/10 rounded transition">
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    <textarea
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={imageBase64 ? "Ask anything about this image..." : "Type / for commands or ask anything..."}
                        rows={1}
                        disabled={isStreaming}
                        className="w-full pl-12 pr-4 py-3.5 rounded-[var(--radius-lg)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--purple)] focus:ring-1 focus:ring-[var(--purple)] focus:outline-none transition resize-none text-sm disabled:opacity-50 shadow-sm"
                        style={{ maxHeight: 150 }}
                    />

                    {/* Command Palette Dropdown */}
                    {showPalette && filteredCommands.length > 0 && (
                        <div ref={paletteRef} className="absolute left-0 bottom-full mb-2 w-full max-w-lg bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-150">
                            <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2">
                                <Command size={14} className="text-[var(--text-muted)]" />
                                <span className="text-xs text-[var(--text-muted)]">Commands</span>
                                <span className="ml-auto text-[10px] text-[var(--text-muted)] flex items-center gap-2">
                                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[10px]">↑↓</kbd>
                                    navigate
                                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[10px]">↵</kbd>
                                    select
                                </span>
                            </div>
                            <div className="max-h-64 overflow-y-auto py-1">
                                {filteredCommands.map((cmd, i) => {
                                    const Icon = cmd.icon;
                                    return (
                                        <button
                                            key={cmd.command}
                                            onClick={() => {
                                                setShowPalette(false);
                                                onInputChange('');
                                                onSend(cmd.prompt);
                                            }}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition ${i === paletteIndex ? 'bg-[var(--purple)]/10 text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${i === paletteIndex ? 'bg-[var(--purple)]/20' : 'bg-[var(--bg-secondary)]'}`}>
                                                <Icon size={16} className={i === paletteIndex ? 'text-[var(--purple)]' : 'text-[var(--text-muted)]'} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-xs">
                                                    <span className="text-[var(--purple)] font-mono">{cmd.command}</span>
                                                    <span className="ml-2 text-[var(--text-muted)]">{cmd.label}</span>
                                                </div>
                                                <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{cmd.description}</p>
                                            </div>
                                            <ChevronRight size={14} className={`shrink-0 ${i === paletteIndex ? 'text-[var(--purple)]' : 'text-[var(--text-muted)]/50'}`} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Attachment Menu Toggle */}
                    <div className="absolute left-2.5 bottom-2 z-40" ref={attachMenuRef}>
                        <button
                            onClick={() => setShowAttachMenu(!showAttachMenu)}
                            disabled={isStreaming}
                            className={`p-2 rounded-md transition ${showAttachMenu || imageBase64 ? 'text-[var(--purple)] bg-[var(--purple)]/10' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'}`}
                            title="Add Attachment"
                        >
                            <Plus size={18} className={`transition-transform duration-200 ${showAttachMenu ? 'rotate-45' : ''}`} />
                        </button>

                        {showAttachMenu && (
                            <div className="absolute left-0 bottom-full mb-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-2xl p-1.5 flex flex-col gap-1 w-40 animate-in slide-in-from-bottom-2 z-50">
                                <button onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }} className="flex items-center gap-3 px-2.5 py-2 text-sm rounded-md hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] transition text-left">
                                    <ImagePlus size={16} className="text-[var(--purple)] shrink-0" /> <span className="truncate">Upload Image</span>
                                </button>
                                <button onClick={() => { setShowAttachMenu(false); onShowScanner(); }} className="md:hidden flex items-center gap-3 px-2.5 py-2 text-sm rounded-md hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] transition text-left">
                                    <ScanLine size={16} className="text-[var(--gold)] shrink-0" /> <span className="truncate">AR Scanner</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onImageSelect} />

                <button
                    onClick={onShowScanner}
                    disabled={isStreaming}
                    className="hidden md:flex p-3.5 rounded-[var(--radius-lg)] transition text-[var(--gold)] bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--gold)]/10 hover:border-[var(--gold)]/30 shadow-sm shrink-0"
                    title="Offline AR Scanner"
                >
                    <ScanLine size={18} />
                </button>

                <button
                    onClick={onToggleRecording}
                    disabled={isStreaming && !isRecording}
                    className={`p-3.5 rounded-[var(--radius-lg)] transition shadow-sm shrink-0 ${isRecording ? "bg-red-500 text-white animate-pulse" : "bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                    title={isRecording ? "Stop recording" : "Voice query"}
                >
                    {isRecording ? <Square size={18} fill="currentColor" className="opacity-90" /> : <Mic size={18} />}
                </button>

                <button
                    onClick={() => onSend(input)}
                    disabled={(!input.trim() && !imageBase64) || isStreaming}
                    className="p-3.5 rounded-[var(--radius-lg)] bg-[var(--purple)] text-white hover:bg-[var(--purple)]/90 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center min-w-[3rem]"
                >
                    <Send size={18} className={input.trim() || imageBase64 ? "translate-x-0.5 -translate-y-0.5 transition-transform" : ""} />
                </button>
            </div>
        </div>
    );
}
