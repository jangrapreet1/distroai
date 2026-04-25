import { ShoppingCart, CreditCard, UserCheck, FileText, Bell } from "lucide-react";

// ── Types ──
export interface Message {
    role: "user" | "assistant";
    content: string;
    image?: string | null;
    streaming?: boolean;
    charts?: ChartSpec[];
    tables?: TableSpec[];
    askInputs?: AskInputSpec[];
    timestamp: Date;
    failed?: boolean;
    originalQuery?: string;
}
export interface AskInputSpec { step: string; title: string; options: string[] }
export interface ChartSpec { type: "bar" | "line" | "pie"; title: string; data: any[] }
export interface TableSpec { headers: string[]; rows: any[][] }

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
}

// ── Slash Commands ──
export interface SlashCommand {
    command: string;
    label: string;
    description: string;
    icon: any;
    prompt: string;
    subCommands?: { command: string; label: string; prompt: string }[];
}

export const SLASH_COMMANDS: SlashCommand[] = [
    {
        command: "/order",
        label: "Order",
        description: "Create, list, or manage orders",
        icon: ShoppingCart,
        prompt: "/order new",
        subCommands: [
            { command: "/order new", label: "New Order", prompt: "/order new" },
            { command: "/order list", label: "Recent Orders", prompt: "/order list" },
            { command: "/order cancel", label: "Cancel Order", prompt: "/order cancel" },
        ],
    },
    {
        command: "/payment",
        label: "Payment",
        description: "Record payments or check dues",
        icon: CreditCard,
        prompt: "/payment collect",
        subCommands: [
            { command: "/payment collect", label: "Collect Payment", prompt: "/payment collect" },
            { command: "/payment pending", label: "Pending Dues", prompt: "/payment pending" },
        ],
    },
    {
        command: "/customer",
        label: "Customer",
        description: "Look up a customer's ledger & balance",
        icon: UserCheck,
        prompt: "/customer",
    },
    {
        command: "/report",
        label: "Report",
        description: "Daily or weekly business summary",
        icon: FileText,
        prompt: "/report today",
        subCommands: [
            { command: "/report today", label: "Today's Summary", prompt: "/report today" },
            { command: "/report week", label: "Weekly Report", prompt: "/report week" },
            { command: "/report top", label: "Top Selling SKUs", prompt: "/report top" },
        ],
    },
    {
        command: "/remind",
        label: "Remind",
        description: "Payment follow-up for defaulters",
        icon: Bell,
        prompt: "/remind",
    },
];


export const API_BASE = "/api/v1";
export const COLORS = ["#a855f7", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

// ── Parser ──
export function parseAIResponse(text: string): { cleanText: string; charts: ChartSpec[]; tables: TableSpec[]; askInputs: AskInputSpec[] } {
    const chartRegex = /<chart type="(.*?)" title="(.*?)">([\s\S]*?)<\/chart>/g;
    const tableRegex = /<table headers="(.*?)">([\s\S]*?)<\/table>/g;
    const askInputRegex = /<ask_input step="(.*?)" title="(.*?)">([\s\S]*?)<\/ask_input>/g;

    const charts: ChartSpec[] = [];
    const tables: TableSpec[] = [];
    const askInputs: AskInputSpec[] = [];

    for (const match of text.matchAll(chartRegex)) {
        try { charts.push({ type: match[1] as any, title: match[2], data: JSON.parse(match[3]) }); } catch { }
    }
    for (const match of text.matchAll(tableRegex)) {
        try { tables.push({ headers: match[1].split(","), rows: JSON.parse(match[2]) }); } catch { }
    }
    for (const match of text.matchAll(askInputRegex)) {
        try { askInputs.push({ step: match[1], title: match[2], options: JSON.parse(match[3]) }); } catch { }
    }
    // Strip any raw XML tags that shouldn't be shown to users
    const toolCallRegex = /<\/?tool_call[^>]*>/g;
    const thinkRegex = /<\/?think[^>]*>/g;
    const cleanText = text
        .replace(chartRegex, "")
        .replace(tableRegex, "")
        .replace(askInputRegex, "")
        .replace(toolCallRegex, "")
        .replace(thinkRegex, "")
        .trim();
    return { cleanText, charts, tables, askInputs };
}
