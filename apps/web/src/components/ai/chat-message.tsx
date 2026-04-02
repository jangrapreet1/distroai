"use client";

import { RefreshCw, X, ChevronRight, PenLine } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message, ChartSpec, TableSpec, AskInputSpec } from "./ai-types";
import { COLORS } from "./ai-types";

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

function InteractiveInputCard({ spec, onSelect }: { spec: AskInputSpec, onSelect: (opt: string) => void }) {
    const fallbackOptIndex = spec.options.findIndex(o => o.toLowerCase().includes("manually") || o.toLowerCase().includes("something else"));
    const mainOptions = fallbackOptIndex >= 0 ? spec.options.filter((_, i) => i !== fallbackOptIndex) : spec.options;
    const fallbackOpt = fallbackOptIndex >= 0 ? spec.options[fallbackOptIndex] : null;

    return (
        <div className="mt-4 bg-[#232323] border border-[#333] rounded-xl overflow-hidden shadow-lg font-sans w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-[#333]">
                <h3 className="text-[15px] font-medium text-white">{spec.title}</h3>
                <div className="flex items-center gap-3 text-[#888] text-[13px]">
                    {spec.step && <span>&lt; {spec.step.replace(' of ', ' of ')} &gt;</span>}
                    <button className="hover:text-white transition"><X size={16} /></button>
                </div>
            </div>
            <div className="p-2 space-y-1 border-b border-[#333]">
                {mainOptions.map((opt, i) => (
                    <button key={i} onClick={() => onSelect(opt)}
                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-[#2c2c2c] transition text-left group">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#111] text-[#ccc] text-xs font-medium">{i + 1}</span>
                            <span className="text-[14px] text-[#eee]">{opt}</span>
                        </div>
                        <ChevronRight size={16} className="text-[#555] opacity-0 group-hover:opacity-100 transition" />
                    </button>
                ))}
            </div>
            <div className="flex items-center justify-between p-3">
                {fallbackOpt ? (
                    <button onClick={() => onSelect(fallbackOpt)} className="flex items-center gap-2 text-[#aaa] hover:text-[#eee] transition text-[13px] px-2 py-1.5 rounded-md hover:bg-[#333]">
                        <div className="w-5 h-5 flex items-center justify-center rounded-full bg-[#111]"><PenLine size={10} /></div>
                        {fallbackOpt}
                    </button>
                ) : <div />}
                <button onClick={() => onSelect("Skip")} className="px-4 py-1.5 rounded-lg border border-[#444] text-[#ccc] text-[13px] hover:bg-[#333] hover:text-white transition">
                    Skip
                </button>
            </div>
        </div>
    );
}

export function ChatMessage({ message, onRetry, onSelectInput }: {
    message: Message;
    onRetry: (query: string) => void;
    onSelectInput: (opt: string) => void;
}) {
    return (
        <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${message.role === "user" ? "bg-[var(--gold)]/10 text-[var(--text-primary)] border border-[var(--gold)]/20 rounded-tr-sm" : "bg-[var(--bg-card)] border border-[var(--border)] rounded-tl-sm"}`}>
                {message.image && <img src={message.image} alt="Upload" className="max-w-[150px] md:max-w-[200px] rounded-lg mb-3 object-cover border border-[var(--border)] shadow-sm" />}
                {message.role === "assistant" ? (
                    <div className="ai-markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    </div>
                ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                )}
                {message.streaming && !message.content && (
                    <div className="flex gap-1.5 mt-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                )}
                {message.streaming && message.content && <span className="inline-block w-1 h-4 bg-[var(--purple)] animate-pulse ml-1 align-middle" />}
                {message.failed && (
                    <button onClick={() => { if (message.originalQuery) onRetry(message.originalQuery); }}
                        className="flex items-center gap-1.5 mt-3 px-3 py-1.5 text-xs rounded-lg bg-[var(--purple)]/10 text-[var(--purple)] hover:bg-[var(--purple)]/20 transition font-medium">
                        <RefreshCw size={12} /> Retry
                    </button>
                )}
                {(message.charts || []).map((c, ci) => <InlineChart key={ci} spec={c} />)}
                {(message.tables || []).map((t, ti) => <InlineTable key={ti} spec={t} />)}
                {(message.askInputs || []).map((ask, ai) => <InteractiveInputCard key={ai} spec={ask} onSelect={onSelectInput} />)}
            </div>
        </div>
    );
}
