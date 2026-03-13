"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Bot, Sparkles, BarChart3, Users, Package, Clock, Square } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Message {
    role: "user" | "assistant";
    content: string;
    streaming?: boolean;
    charts?: ChartSpec[];
    tables?: TableSpec[];
    timestamp: Date;
}
interface ChartSpec { type: "bar" | "line" | "pie"; title: string; data: any[] }
interface TableSpec { headers: string[]; rows: any[][] }

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
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isStreaming) return;

        const userMsg: Message = { role: "user", content: text.trim(), timestamp: new Date() };
        setMessages((m) => [...m, userMsg]);
        setInput("");
        setIsStreaming(true);

        // Add placeholder AI message
        setMessages((m) => [...m, { role: "assistant", content: "", streaming: true, charts: [], tables: [], timestamp: new Date() }]);

        try {
            const res = await fetch(`${API_BASE}/ai/query/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ query: text }),
            });

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
                            setMessages((m) => m.map((msg, i) =>
                                i === m.length - 1 ? { ...msg, content: parsed.cleanText, charts: parsed.charts, tables: parsed.tables } : msg
                            ));
                        }
                        if (data.done) break;
                    } catch { }
                }
            }

            // Finalize message
            setMessages((m) => m.map((msg, i) => i === m.length - 1 ? { ...msg, streaming: false } : msg));
        } catch (err: any) {
            setMessages((m) => m.map((msg, i) => i === m.length - 1
                ? { ...msg, content: `Error: ${err.message}. Please try again.`, streaming: false } : msg
            ));
        } finally {
            setIsStreaming(false);
        }
    }, [isStreaming, accessToken]);

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

                const formData = new FormData();
                formData.append("audio", audioBlob, "voice.webm");

                setIsStreaming(true);
                setMessages((m) => [...m, { role: "user", content: "🎤 Voice message...", timestamp: new Date() }]);
                setMessages((m) => [...m, { role: "assistant", content: "", streaming: true, charts: [], tables: [], timestamp: new Date() }]);

                try {
                    const res = await fetch(`${API_BASE}/ai/voice-query`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${accessToken}` },
                        body: formData,
                    });
                    const data = await res.json();
                    setMessages((m) => m.map((msg, i) => i === m.length - 2 ? { ...msg, content: `🎤 "${data.transcription}"` } : msg));
                    const parsed = parseAIResponse(data.response || "");
                    setMessages((m) => m.map((msg, i) => i === m.length - 1
                        ? { ...msg, content: parsed.cleanText, charts: parsed.charts, tables: parsed.tables, streaming: false } : msg
                    ));
                } catch (e) {
                    setMessages((m) => m.map((msg, i) => i === m.length - 1
                        ? { ...msg, content: "Unable to process voice query.", streaming: false } : msg
                    ));
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
    }, [isRecording, accessToken]);

    const pastConversations = [
        "Yesterday's sales summary", "Stockout predictions for March",
        "Customer payment analysis", "Best selling products Q4", "Route optimization suggestions",
    ];

    return (
        <div className="flex h-[calc(100vh-3.5rem-3rem)] gap-0 -m-4 lg:-m-6">
            {/* Left Panel */}
            <div className="hidden lg:flex flex-col w-72 border-r border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
                <div className="p-4 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2 mb-3">
                        <Bot size={20} className="text-[var(--purple)]" />
                        <h2 className="font-bold">DistroAI</h2>
                    </div>
                    <button onClick={() => setMessages([])} className="w-full py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition">New Chat</button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {pastConversations.map((c, i) => (
                        <button key={i} className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)] rounded-lg transition truncate">{c}</button>
                    ))}
                </div>
                <div className="p-3 border-t border-[var(--border)]">
                    <p className="text-[10px] text-[var(--text-muted)] mb-2">TRY ASKING</p>
                    {EXAMPLE_PROMPTS.slice(0, 2).map((p, i) => (
                        <button key={i} onClick={() => sendMessage(p.text)} className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">&quot;{p.text}&quot;</button>
                    ))}
                </div>
            </div>

            {/* Right Panel — Chat */}
            <div className="flex-1 flex flex-col min-w-0">
                {messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="text-center max-w-md">
                            <div className="w-16 h-16 rounded-2xl bg-[var(--purple)]/15 flex items-center justify-center mx-auto mb-6">
                                <Sparkles size={28} className="text-[var(--purple)]" />
                            </div>
                            <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-playfair)" }}>Ask me anything about your business</h2>
                            <p className="text-sm text-[var(--text-secondary)] mb-8">I can analyze sales, predict stockouts, score customers, and generate reports.</p>
                            <div className="grid grid-cols-2 gap-3">
                                {EXAMPLE_PROMPTS.map((p, i) => (
                                    <button key={i} onClick={() => sendMessage(p.text)} className="flex items-start gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-left text-sm text-[var(--text-secondary)] hover:border-[var(--purple)]/30 transition">
                                        <p.icon size={16} className="text-[var(--purple)] mt-0.5 shrink-0" />
                                        {p.text}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[75%] rounded-xl px-4 py-3 text-sm ${m.role === "user" ? "bg-[var(--gold)]/15 text-[var(--text-primary)] border border-[var(--gold)]/20" : "bg-[var(--bg-card)] border border-[var(--border)]"}`}>
                                    <div className="whitespace-pre-wrap">{m.content}</div>
                                    {m.streaming && !m.content && (
                                        <div className="flex gap-1 mt-1">
                                            <span className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: "0ms" }} />
                                            <span className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: "150ms" }} />
                                            <span className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </div>
                                    )}
                                    {m.streaming && m.content && <span className="inline-block w-1 h-4 bg-[var(--purple)] animate-pulse ml-0.5 align-middle" />}
                                    {(m.charts || []).map((c, ci) => <InlineChart key={ci} spec={c} />)}
                                    {(m.tables || []).map((t, ti) => <InlineTable key={ti} spec={t} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Input */}
                <div className="p-4 border-t border-[var(--border)]">
                    <div className="flex items-end gap-2">
                        <div className="flex-1 relative">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                                placeholder="Ask DistroAI anything..."
                                rows={1}
                                disabled={isStreaming}
                                className="w-full px-4 py-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--purple)] focus:outline-none transition resize-none text-sm disabled:opacity-50"
                                style={{ maxHeight: 120 }}
                            />
                        </div>
                        <button
                            onClick={toggleRecording}
                            disabled={isStreaming && !isRecording}
                            className={`p-3 rounded-[var(--radius-md)] transition ${isRecording ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                            title={isRecording ? "Stop recording" : "Voice query"}
                        >
                            {isRecording ? <Square size={18} /> : <Mic size={18} />}
                        </button>
                        <button onClick={() => sendMessage(input)} disabled={!input.trim() || isStreaming} className="p-3 rounded-[var(--radius-md)] bg-[var(--purple)] text-white hover:bg-[var(--purple)]/80 transition disabled:opacity-30">
                            <Send size={18} />
                        </button>
                    </div>
                    {isRecording && (
                        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" /> Recording... tap Stop when done
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
