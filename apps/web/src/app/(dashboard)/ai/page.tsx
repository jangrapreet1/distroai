"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Sparkles, Package, Users, BarChart3, Clock, MessageSquare } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { OfflineScanner } from "@/components/Scanner/OfflineScanner";
import { ChatMessage } from "@/components/ai/chat-message";
import { ChatSidebar } from "@/components/ai/chat-sidebar";
import { ChatInput } from "@/components/ai/chat-input";
import { parseAIResponse, API_BASE } from "@/components/ai/ai-types";
import type { Message, ChatSession } from "@/components/ai/ai-types";

const EXAMPLE_PROMPTS = [
    { icon: Package, text: "Which products will stock out this week?" },
    { icon: Users, text: "Show me top 5 defaulters" },
    { icon: BarChart3, text: "Compare sales this vs last month" },
    { icon: Clock, text: "Collection plan for today" },
];

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
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [showHistoryMenu, setShowHistoryMenu] = useState(false);

    const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
    const messages = activeSession?.messages || [];

    // Fetch history
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
                        const sessionMap = new Map<string, ChatSession>();
                        for (const q of dataObj) {
                            const sid = q.sessionId || `legacy-${new Date(q.createdAt).toISOString().split('T')[0]}`;
                            if (!sessionMap.has(sid)) {
                                sessionMap.set(sid, { id: sid, title: q.query.substring(0, 30) + (q.query.length > 30 ? "..." : ""), messages: [] });
                            }
                            const s = sessionMap.get(sid)!;
                            s.messages.push({ role: 'user', content: q.query, timestamp: new Date(q.createdAt) });
                            if (!q.response) {
                                s.messages.push({ role: 'assistant', content: 'This query didn\'t receive a response.', charts: [], tables: [], timestamp: new Date(q.createdAt), streaming: false, failed: true, originalQuery: q.query });
                            } else {
                                const parsed = parseAIResponse(q.response);
                                s.messages.push({ role: 'assistant', content: parsed.cleanText, charts: parsed.charts, tables: parsed.tables, timestamp: new Date(q.createdAt) });
                            }
                        }
                        const sessionsArray = Array.from(sessionMap.values()).reverse();
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
        if (accessToken) { fetchHistory(); } else { setIsLoadingHistory(false); }
    }, [accessToken]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
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
            setSessions(prev => prev.map(s => s.id === currentSessionId && s.title === "New Conversation" ? { ...s, title: finalQuery.substring(0, 30) } : s));
        }

        const userMsg: Message = { role: "user", content: finalQuery, image: imageBase64, timestamp: new Date() };
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, userMsg] } : s));
        setInput("");
        setIsStreaming(true);

        const placeholder: Message = { role: "assistant", content: "", streaming: true, charts: [], tables: [], timestamp: new Date() };
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, placeholder] } : s));

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 60000);

            const res = await fetch(`${API_BASE}/ai/query/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ query: text, sessionId: currentSessionId, ...(imageBase64 ? { image: imageBase64 } : {}) }),
                signal: controller.signal,
            });

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
                        const data = JSON.parse(line.replace(/^data:\s?/, "").trim());
                        if (data.error === 'AI_QUOTA_EXCEEDED') {
                            // Show quota error as a failed message with the server's message
                            setSessions(prev => prev.map(s => {
                                if (s.id !== currentSessionId) return s;
                                const newMsgs = [...s.messages];
                                newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: data.token || 'Monthly AI query limit reached.', streaming: false, failed: false };
                                return { ...s, messages: newMsgs };
                            }));
                            break;
                        }
                        if (data.token) {
                            fullResponse += data.token;
                            const parsed = parseAIResponse(fullResponse);
                            setSessions(prev => prev.map(s => {
                                if (s.id !== currentSessionId) return s;
                                const newMsgs = [...s.messages];
                                newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: parsed.cleanText, charts: parsed.charts, tables: parsed.tables, askInputs: parsed.askInputs };
                                return { ...s, messages: newMsgs };
                            }));
                        }
                        if (data.done) break;
                    } catch { }
                }
            }

            clearTimeout(timeout);
            setSessions(prev => prev.map(s => {
                if (s.id !== currentSessionId) return s;
                const newMsgs = [...s.messages];
                newMsgs[newMsgs.length - 1].streaming = false;
                return { ...s, messages: newMsgs };
            }));

        } catch (err: any) {
            const isTimeout = err.name === 'AbortError';
            setSessions(prev => prev.map(s => {
                if (s.id !== currentSessionId) return s;
                const newMsgs = [...s.messages];
                newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: isTimeout ? 'Request timed out. Please try again.' : `Error: ${err.message}. Please try again.`, streaming: false, failed: true, originalQuery: text };
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
                if (currentSessionId) formData.append("sessionId", currentSessionId);
                setIsStreaming(true);
                const userMsg: Message = { role: "user", content: "🎤 Voice message...", timestamp: new Date() };
                const aiMsg: Message = { role: "assistant", content: "", streaming: true, charts: [], tables: [], timestamp: new Date() };
                setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, userMsg, aiMsg] } : s));
                try {
                    const res = await fetch(`${API_BASE}/ai/voice-query`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: formData });
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
        <div className="flex h-[calc(100vh-3.5rem-3rem)] gap-0 -m-4 lg:-m-6 relative overflow-hidden">
            {showScanner && <OfflineScanner onClose={() => setShowScanner(false)} />}

            <ChatSidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                showHistoryMenu={showHistoryMenu}
                onSelectSession={setActiveSessionId}
                onNewChat={handleNewChat}
                onCloseMenu={() => setShowHistoryMenu(false)}
            />

            {/* Right Panel — Chat */}
            <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-primary)]">
                {/* Mobile History Toggle Header */}
                <div className="lg:hidden flex items-center justify-between p-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-[var(--purple)]" />
                        <span className="font-semibold text-sm">AI Chat</span>
                    </div>
                    <button onClick={() => setShowHistoryMenu(true)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
                        <MessageSquare size={18} />
                    </button>
                </div>

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
                            <ChatMessage key={i} message={m} onRetry={sendMessage} onSelectInput={sendMessage} />
                        ))}
                    </div>
                )}

                <ChatInput
                    input={input}
                    onInputChange={setInput}
                    onSend={sendMessage}
                    isStreaming={isStreaming}
                    imagePreview={imagePreview}
                    imageBase64={imageBase64}
                    onImageSelect={handleImageSelect}
                    onClearImage={() => { setImagePreview(null); setImageBase64(null); }}
                    onToggleRecording={toggleRecording}
                    isRecording={isRecording}
                    onShowScanner={() => setShowScanner(true)}
                />
            </div>
        </div>
    );
}
