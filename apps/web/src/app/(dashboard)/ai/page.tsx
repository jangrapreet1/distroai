"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Mic, MicOff, Bot, Sparkles, BarChart3, Users, Package, Clock, Square, ImagePlus, X, ScanLine, MessageSquare } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { OfflineScanner } from "@/components/Scanner/OfflineScanner";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Message {
    role: "user" | "assistant";
    content: string;
    image?: string | null;
    streaming?: boolean;
    charts?: ChartSpec[];
    tables?: TableSpec[];
    timestamp: Date;
}
interface ChartSpec { type: "bar" | "line" | "pie"; title: string; data: any[] }
interface TableSpec { headers: string[]; rows: any[][] }

interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
}

const EXAMPLE_PROMPTS = [
    { icon: Package, text: "Which products will stock out this week?" },
    { icon: Users, text: "Show me top 5 defaulters" },
    { icon: BarChart3, text: "Compare sales this vs last month" },
    { icon: Clock, text: "Collection plan for today" },
];

const API_BASE = "/api/v1";
const COLORS = ["#a855f7", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

function parseAIResponse(text: string): { cleanText: string; charts: ChartSpec[]; tables: TableSpec[] } {
    const chartRegex = /<chart type="(.*?)" title="(.*?)">([\s\S]*?)<\/chart>/g;
    const tableRegex = /<table headers="(.*?)">([\s\S]*?)<\/table>/g;

    const charts: ChartSpec[] = [];
    const tables: TableSpec[] = [];

    for (const match of text.matchAll(chartRegex)) {
        try { charts.push({ type: match[1] as any, title: match[2], data: JSON.parse(match[3]) }); } catch { }
    }
    for (const match of text.matchAll(tableRegex)) {
        try { tables.push({ headers: match[1].split(","), rows: JSON.parse(match[2]) }); } catch { }
    }
    const cleanText = text.replace(chartRegex, "").replace(tableRegex, "").trim();
    return { cleanText, charts, tables };
}

function InlineChart({ spec }: { spec: ChartSpec }) {
    if (spec.type === "pie") {
        return (
            <div className="mt-3">
                <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">{spec.title}</p>
                <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                        <Pie data={spec.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name }) => name}>
                            {spec.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    }
    const ChartComp = spec.type === "line" ? LineChart : BarChart;
    const DataComp = spec.type === "line" ? <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} dot={false} /> : <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />;
    return (
        <div className="mt-3">
            <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">{spec.title}</p>
            <ResponsiveContainer width="100%" height={160}>
                <ChartComp data={spec.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    {DataComp}
                </ChartComp>
            </ResponsiveContainer>
        </div>
    );
}

function InlineTable({ spec }: { spec: TableSpec }) {
    return (
        <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="text-xs w-full">
                <thead>
                    <tr className="bg-[var(--bg-secondary)]">
                        {spec.headers.map((h, i) => <th key={i} className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)]">{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {spec.rows.map((row, i) => (
                        <tr key={i} className="border-t border-[var(--border)] hover:bg-[var(--bg-secondary)] transition">
                            {(Array.isArray(row) ? row : Object.values(row)).map((cell: any, j) => (
                                <td key={j} className="px-3 py-2 text-[var(--text-secondary)]">{String(cell)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function AIPage() {
    const accessToken = useAuthStore((s) => s.accessToken);

    // Chat Session State
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    const [input, setInput] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
    const messages = activeSession?.messages || [];

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`${API_BASE}/ai/history`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (res.ok) {
                    const json = await res.json();
                    const dataObj = json.data || json;
                    if (dataObj && Array.isArray(dataObj) && dataObj.length > 0) {
                        // Group by sessionId
                        const sessionMap = new Map<string, ChatSession>();

                        for (const q of dataObj) {
                            // If no sessionId, assign a generic one based on date or just 'default' to fix legacy data
                            const sid = q.sessionId || `legacy-${new Date(q.createdAt).toISOString().split('T')[0]}`;
                            if (!sessionMap.has(sid)) {
                                sessionMap.set(sid, {
                                    id: sid,
                                    title: q.query.substring(0, 30) + (q.query.length > 30 ? "..." : ""),
                                    messages: []
                                });
                            }

                            const s = sessionMap.get(sid)!;
                            s.messages.push({
                                role: 'user',
                                content: q.query,
                                timestamp: new Date(q.createdAt)
                            });

                            if (!q.response) {
                                s.messages.push({
                                    role: 'assistant',
                                    content: 'Processing in background...',
                                    charts: [], tables: [],
                                    timestamp: new Date(q.createdAt),
                                    streaming: false
                                });
                            } else {
                                const parsed = parseAIResponse(q.response);
                                s.messages.push({
                                    role: 'assistant',
                                    content: parsed.cleanText,
                                    charts: parsed.charts, tables: parsed.tables,
                                    timestamp: new Date(q.createdAt)
                                });
                            }
                        }

                        const sessionsArray = Array.from(sessionMap.values()).reverse(); // newest first
                        setSessions(sessionsArray);
                        if (sessionsArray.length > 0 && !activeSessionId) {
                            setActiveSessionId(sessionsArray[0].id);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to fetch AI history', err);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        if (accessToken) {
            fetchHistory();
        } else {
            setIsLoadingHistory(false);
        }
    }, [accessToken]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        }
    }, [messages]);

    const handleNewChat = () => {
        const newId = `session-${Date.now()}`;
        setSessions([{ id: newId, title: "New Conversation", messages: [] }, ...sessions]);
        setActiveSessionId(newId);
    };

    const sendMessage = useCallback(async (text: string) => {
        if ((!text.trim() && !imageBase64) || isStreaming) return;

        const finalQuery = text.trim() || 'Look up this product';
        const currentSessionId = activeSessionId || `session-${Date.now()}`;

        if (!activeSessionId) {
            setActiveSessionId(currentSessionId);
            setSessions(prev => [{ id: currentSessionId, title: finalQuery.substring(0, 30), messages: [] }, ...prev]);
        } else {
            // Update title if it was a new chat
            setSessions(prev => prev.map(s => s.id === currentSessionId && s.title === "New Conversation" ? { ...s, title: finalQuery.substring(0, 30) } : s));
        }

        const userMsg: Message = { role: "user", content: finalQuery, image: imageBase64, timestamp: new Date() };

        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, userMsg] } : s));
        setInput("");
        setIsStreaming(true);

        // Add placeholder AI message
        const placeholder: Message = { role: "assistant", content: "", streaming: true, charts: [], tables: [], timestamp: new Date() };
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, placeholder] } : s));

        try {
            const res = await fetch(`${API_BASE}/ai/query/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ query: text, sessionId: currentSessionId, ...(imageBase64 ? { image: imageBase64 } : {}) }),
            });

            // Clear image after sending
            setImagePreview(null);
            setImageBase64(null);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let fullResponse = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n").filter((l) => l.startsWith("data:"));

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line.replace("data:", "").trim());
                        if (data.token) {
                            fullResponse += data.token;
                            const parsed = parseAIResponse(fullResponse);

                            setSessions(prev => prev.map(s => {
                                if (s.id !== currentSessionId) return s;
                                const newMsgs = [...s.messages];
                                newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: parsed.cleanText, charts: parsed.charts, tables: parsed.tables };
                                return { ...s, messages: newMsgs };
                            }));
                        }
                        if (data.done) break;
                    } catch { }
                }
            }

            // Finalize message
            setSessions(prev => prev.map(s => {
                if (s.id !== currentSessionId) return s;
                const newMsgs = [...s.messages];
                newMsgs[newMsgs.length - 1].streaming = false;
                return { ...s, messages: newMsgs };
            }));

        } catch (err: any) {
            setSessions(prev => prev.map(s => {
                if (s.id !== currentSessionId) return s;
                const newMsgs = [...s.messages];
                newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: `Error: ${err.message}. Please try again.`, streaming: false };
                return { ...s, messages: newMsgs };
            }));
        } finally {
            setIsStreaming(false);
        }
    }, [isStreaming, accessToken, imageBase64, activeSessionId]);

    const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
        if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10MB.'); return; }

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            setImagePreview(URL.createObjectURL(file));
            setImageBase64(base64);
        };
        reader.readAsDataURL(file);
        // Reset input so same file can be re-selected
        e.target.value = '';
    }, []);

    const toggleRecording = useCallback(async () => {
        if (isRecording) {
            mediaRecorder.current?.stop();
            setIsRecording(false);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
            audioChunks.current = [];

            mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.current.push(e.data); };
            mr.onstop = async () => {
                const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
                stream.getTracks().forEach((t) => t.stop());

                const currentSessionId = activeSessionId || `session-${Date.now()}`;
                if (!activeSessionId) {
                    setActiveSessionId(currentSessionId);
                    setSessions(prev => [{ id: currentSessionId, title: "Voice Note", messages: [] }, ...prev]);
                }

                const formData = new FormData();
                formData.append("audio", audioBlob, "voice.webm");
                formData.append("sessionId", currentSessionId);

                setIsStreaming(true);

                const userMsg: Message = { role: "user", content: "🎤 Voice message...", timestamp: new Date() };
                const aiMsg: Message = { role: "assistant", content: "", streaming: true, charts: [], tables: [], timestamp: new Date() };

                setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, userMsg, aiMsg] } : s));

                try {
                    const res = await fetch(`${API_BASE}/ai/voice-query`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${accessToken}` },
                        body: formData,
                    });
                    const data = await res.json();

                    const parsed = parseAIResponse(data.response || "");

                    setSessions(prev => prev.map(s => {
                        if (s.id !== currentSessionId) return s;
                        const newMsgs = [...s.messages];
                        newMsgs[newMsgs.length - 2].content = `🎤 "${data.transcription}"`;
                        newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: parsed.cleanText, charts: parsed.charts, tables: parsed.tables, streaming: false };
                        return { ...s, messages: newMsgs };
                    }));

                } catch (e) {
                    setSessions(prev => prev.map(s => {
                        if (s.id !== currentSessionId) return s;
                        const newMsgs = [...s.messages];
                        newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: "Unable to process voice query.", streaming: false };
                        return { ...s, messages: newMsgs };
                    }));
                } finally {
                    setIsStreaming(false);
                }
            };

            mr.start();
            mediaRecorder.current = mr;
            setIsRecording(true);
        } catch {
            alert("Microphone permission denied.");
        }
    }, [isRecording, accessToken, activeSessionId]);


    return (
        <div className="flex h-[calc(100vh-3.5rem-3rem)] gap-0 -m-4 lg:-m-6">
            {showScanner && <OfflineScanner onClose={() => setShowScanner(false)} />}
            {/* Left Panel */}
            <div className="hidden lg:flex flex-col w-72 border-r border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
                <div className="p-4 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2 mb-3">
                        <Bot size={20} className="text-[var(--purple)]" />
                        <h2 className="font-bold">DistroAI</h2>
                    </div>
                    <button onClick={handleNewChat} className="flex items-center justify-center gap-2 w-full py-2.5 text-sm rounded-[var(--radius-md)] bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)]/20 transition font-medium border border-[var(--gold)]/20">
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
                                onClick={() => setActiveSessionId(s.id)}
                                className={`w-full text-left px-3 py-2.5 text-sm rounded-[var(--radius-md)] transition truncate block ${activeSessionId === s.id ? 'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] font-medium shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/50 border border-transparent'}`}
                                title={s.title}
                            >
                                {s.title}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel — Chat */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#050505]">
                {isLoadingHistory ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <div className="flex gap-1 mt-1 mb-4">
                            <span className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <p className="text-sm text-[var(--text-muted)] animate-pulse">Loading conversation history...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="text-center max-w-md">
                            <div className="w-16 h-16 rounded-2xl bg-[var(--purple)]/15 flex items-center justify-center mx-auto mb-6">
                                <Sparkles size={28} className="text-[var(--purple)]" />
                            </div>
                            <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-playfair)" }}>Ask me anything about your business</h2>
                            <p className="text-sm text-[var(--text-secondary)] mb-8">I can analyze sales, predict stockouts, score customers, and generate reports.</p>
                            <div className="grid grid-cols-2 gap-3">
                                {EXAMPLE_PROMPTS.map((p, i) => (
                                    <button key={i} onClick={() => sendMessage(p.text)} className="flex items-start gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-left text-sm text-[var(--text-secondary)] hover:border-[var(--purple)]/30 transition shadow-sm">
                                        <p.icon size={16} className="text-[var(--purple)] mt-0.5 shrink-0" />
                                        {p.text}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${m.role === "user" ? "bg-[var(--gold)]/10 text-[var(--text-primary)] border border-[var(--gold)]/20 rounded-tr-sm" : "bg-[var(--bg-card)] border border-[var(--border)] rounded-tl-sm"}`}>
                                    {m.image && <img src={m.image} alt="Upload" className="max-w-[150px] md:max-w-[200px] rounded-lg mb-3 object-cover border border-[var(--border)] shadow-sm" />}
                                    <div className="whitespace-pre-wrap">{m.content}</div>
                                    {m.streaming && !m.content && (
                                        <div className="flex gap-1.5 mt-2">
                                            <span className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: "0ms" }} />
                                            <span className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: "150ms" }} />
                                            <span className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </div>
                                    )}
                                    {m.streaming && m.content && <span className="inline-block w-1 h-4 bg-[var(--purple)] animate-pulse ml-1 align-middle" />}
                                    {(m.charts || []).map((c, ci) => <InlineChart key={ci} spec={c} />)}
                                    {(m.tables || []).map((t, ti) => <InlineTable key={ti} spec={t} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                <div className="p-4 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
                    <div className="max-w-4xl mx-auto relative flex items-end gap-2">
                        <div className="flex-1 relative">
                            {/* Attached Image Preview */}
                            {imagePreview && (
                                <div className="absolute left-3 bottom-full mb-2 bg-[#111] border border-[var(--border)] rounded-lg p-1.5 shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2">
                                    <img src={imagePreview} alt="Attached" className="h-12 w-12 rounded object-cover border border-[#222]" />
                                    <button onClick={() => { setImagePreview(null); setImageBase64(null); }} className="p-1 text-[var(--text-muted)] hover:text-red-400 bg-white/5 hover:bg-white/10 rounded transition">
                                        <X size={14} />
                                    </button>
                                </div>
                            )}

                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                                placeholder={imageBase64 ? "Ask anything about this image..." : activeSessionId ? "Reply..." : "Start a new conversation..."}
                                rows={1}
                                disabled={isStreaming}
                                className="w-full pl-12 pr-4 py-3.5 rounded-[var(--radius-lg)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--purple)] focus:ring-1 focus:ring-[var(--purple)] focus:outline-none transition resize-none text-sm disabled:opacity-50 shadow-sm"
                                style={{ maxHeight: 150 }}
                            />

                            {/* Image Attachment Button inside the input */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isStreaming}
                                className={`absolute left-2.5 bottom-2 p-2 rounded-md transition ${imageBase64 ? 'text-[var(--purple)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                                title="Attach Image"
                            >
                                <ImagePlus size={18} />
                            </button>
                        </div>

                        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />

                        <button
                            onClick={() => setShowScanner(true)}
                            disabled={isStreaming}
                            className="p-3.5 rounded-[var(--radius-lg)] transition text-[var(--gold)] bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--gold)]/10 hover:border-[var(--gold)]/30 shadow-sm shrink-0"
                            title="Offline AR Scanner"
                        >
                            <ScanLine size={18} />
                        </button>

                        <button
                            onClick={toggleRecording}
                            disabled={isStreaming && !isRecording}
                            className={`p-3.5 rounded-[var(--radius-lg)] transition shadow-sm shrink-0 ${isRecording ? "bg-red-500 text-white animate-pulse" : "bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                            title={isRecording ? "Stop recording" : "Voice query"}
                        >
                            {isRecording ? <Square size={18} fill="currentColor" className="opacity-90" /> : <Mic size={18} />}
                        </button>

                        <button
                            onClick={() => sendMessage(input)}
                            disabled={(!input.trim() && !imageBase64) || isStreaming}
                            className="p-3.5 rounded-[var(--radius-lg)] bg-[var(--purple)] text-white hover:bg-[var(--purple)]/90 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center min-w-[3rem]"
                        >
                            <Send size={18} className={input.trim() || imageBase64 ? "translate-x-0.5 -translate-y-0.5 transition-transform" : ""} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
