"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
    Plus,
    Search,
    Package,
    Send,
    X,
    FileSpreadsheet,
    Download,
    Layers,
    Clock,
    Truck,
    CheckCircle2,
    SlidersHorizontal,
    Maximize2,
    Minimize2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useOrders, useOrderAction, useBulkOrderAction } from "@/hooks/api-hooks";
import { formatDate, buildWhatsAppInvoiceLink, formatINR, exportToCSV } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ExcelImportModal } from "@/components/excel-import-modal";
import { MarkPaidModal, type OrderToPay } from "@/components/modals/MarkPaidModal";

// ─── PIPELINE STAGE CONFIGURATION ───────────────────────────
export type PipelineStage = "all" | "action_needed" | "in_transit" | "settled";

interface StageFilterChip {
    id: string;
    label: string;
    status?: string;
    source?: string;
}

interface StageDefinition {
    id: PipelineStage;
    label: string;
    icon: typeof Package;
    description: string;
    stageStatuses?: string[];
    chips: StageFilterChip[];
}

const PIPELINE_STAGES: StageDefinition[] = [
    {
        id: "all",
        label: "All Orders",
        icon: Layers,
        description: "Entire order ledger",
        chips: [
            { id: "all", label: "All Orders" },
            { id: "portal", label: "Portal Orders", source: "PORTAL" },
            { id: "whatsapp", label: "WhatsApp Orders", source: "WHATSAPP" },
        ],
    },
    {
        id: "action_needed",
        label: "Action Needed",
        icon: Clock,
        description: "Drafts, to pack & to dispatch",
        stageStatuses: ["DRAFT", "CONFIRMED", "PACKED"],
        chips: [
            { id: "all_action", label: "All Action Needed" },
            { id: "draft", label: "Drafts (To Review)", status: "DRAFT" },
            { id: "confirmed", label: "Confirmed (To Pack)", status: "CONFIRMED" },
            { id: "packed", label: "Packed (To Dispatch)", status: "PACKED" },
        ],
    },
    {
        id: "in_transit",
        label: "In Transit",
        icon: Truck,
        description: "Active shipments on the road",
        stageStatuses: ["DISPATCHED", "PARTIALLY_DELIVERED"],
        chips: [
            { id: "all_transit", label: "All in Transit" },
            { id: "dispatched", label: "Dispatched", status: "DISPATCHED" },
            { id: "partially_delivered", label: "Partially Delivered", status: "PARTIALLY_DELIVERED" },
        ],
    },
    {
        id: "settled",
        label: "Settled",
        icon: CheckCircle2,
        description: "Delivered, closed, or returned",
        stageStatuses: ["DELIVERED", "COMPLETED", "PARTIALLY_RETURNED", "RETURNED", "CANCELLED"],
        chips: [
            { id: "all_settled", label: "All Settled" },
            { id: "delivered", label: "Delivered", status: "DELIVERED" },
            { id: "completed", label: "Completed", status: "COMPLETED" },
            { id: "returned", label: "Returned", status: "RETURNED" },
            { id: "cancelled", label: "Cancelled", status: "CANCELLED" },
        ],
    },
];

// ─── STATUS BADGE STYLES (Linear/Stripe Minimalist Aesthetic) ─
const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
    DRAFT: {
        label: "Draft",
        dot: "bg-zinc-400",
        badge: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
    },
    CONFIRMED: {
        label: "Confirmed",
        dot: "bg-blue-500",
        badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    PACKED: {
        label: "Packed",
        dot: "bg-indigo-500",
        badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    },
    DISPATCHED: {
        label: "Dispatched",
        dot: "bg-amber-500",
        badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    PARTIALLY_DELIVERED: {
        label: "Partial Delivery",
        dot: "bg-orange-500",
        badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    },
    DELIVERED: {
        label: "Delivered",
        dot: "bg-emerald-500",
        badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    COMPLETED: {
        label: "Completed",
        dot: "bg-emerald-500",
        badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    PARTIALLY_RETURNED: {
        label: "Partial Return",
        dot: "bg-rose-400",
        badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    },
    RETURNED: {
        label: "Returned",
        dot: "bg-rose-500",
        badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    },
    CANCELLED: {
        label: "Cancelled",
        dot: "bg-zinc-400",
        badge: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
    },
};

function StatusBadge({ status }: { status: string }) {
    const config = STATUS_CONFIG[status] || {
        label: status,
        dot: "bg-zinc-400",
        badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    };

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border tabular-nums whitespace-nowrap ${config.badge}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
            {config.label}
        </span>
    );
}

function PaymentBadge({ order }: { order: any }) {
    if (order.status === "RETURNED") {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase border bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20">
                RETURNED
            </span>
        );
    }
    if (order.status === "CANCELLED") {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                VOID
            </span>
        );
    }

    const net = Number(order.netAmount) || 0;
    const paid = Number(order.paidAmount) || 0;
    const invoiceBalance = order.invoice?.balanceAmount;

    if (net === 0) {
        return <span className="text-zinc-400 text-xs">—</span>;
    }

    let isPaid = false;
    let isPartial = false;

    if (invoiceBalance != null) {
        if (invoiceBalance <= 0) isPaid = true;
        else if (invoiceBalance < net) isPartial = true;
    } else {
        if (paid >= net) isPaid = true;
        else if (paid > 0) isPartial = true;
    }

    if (isPaid) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                PAID
            </span>
        );
    }

    if (isPartial) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                PARTIAL
            </span>
        );
    }

    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase border bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">
            UNPAID
        </span>
    );
}

function SourceBadge({ source }: { source?: string }) {
    const src = source ?? "MANUAL";
    const styles: Record<string, string> = {
        PORTAL: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        WHATSAPP: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        APP: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        MANUAL: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20",
    };

    return (
        <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border ${styles[src] ?? styles.MANUAL}`}
        >
            {src}
        </span>
    );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function OrdersPage() {
    const queryClient = useQueryClient();
    const { t } = useLanguage();
    const bulkOrder = useBulkOrderAction();

    // Pipeline & filter states
    const [stage, setStage] = useState<PipelineStage>("all");
    const [activeChip, setActiveChip] = useState<string>("all");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [showImport, setShowImport] = useState(false);
    const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
    const [ordersToPay, setOrdersToPay] = useState<OrderToPay[]>([]);

    // Persistent row density toggle ("default" 44px vs "compact" 32px)
    const [density, setDensity] = useState<"default" | "compact">("default");

    useEffect(() => {
        const saved = localStorage.getItem("distroai_orders_density");
        if (saved === "compact" || saved === "default") {
            setDensity(saved);
        }
    }, []);

    const handleDensityChange = (newDensity: "default" | "compact") => {
        setDensity(newDensity);
        localStorage.setItem("distroai_orders_density", newDensity);
    };

    // Current stage definition
    const currentStageDef = useMemo(
        () => PIPELINE_STAGES.find((s) => s.id === stage) ?? PIPELINE_STAGES[0],
        [stage]
    );

    // Selected chip definition
    const currentChipDef = useMemo(
        () => currentStageDef.chips.find((c) => c.id === activeChip) ?? currentStageDef.chips[0],
        [currentStageDef, activeChip]
    );

    const handleStageChange = (newStage: PipelineStage) => {
        setStage(newStage);
        const nextDef = PIPELINE_STAGES.find((s) => s.id === newStage) ?? PIPELINE_STAGES[0];
        setActiveChip(nextDef.chips[0].id);
        setPage(1);
        setSelectedOrders([]);
    };

    const handleChipChange = (chipId: string) => {
        setActiveChip(chipId);
        setPage(1);
        setSelectedOrders([]);
    };

    // Build API query parameters
    const queryFilters = useMemo(() => {
        return {
            ...(currentChipDef.status && { status: currentChipDef.status }),
            ...(currentChipDef.source && { source: currentChipDef.source }),
            ...(search && { search }),
            page,
            limit: 25,
        };
    }, [currentChipDef, search, page]);

    const { data, isLoading } = useOrders(queryFilters);

    // Filter displayed orders for multi-status stage presets
    const rawOrders = data?.data ?? [];
    const meta = data?.meta ?? { total: 0, pages: 0 };

    const orders = useMemo(() => {
        if (!Array.isArray(rawOrders)) return [];
        // If an explicit status or source is queried via backend, rawOrders is already filtered
        if (currentChipDef.status || currentChipDef.source) {
            return rawOrders;
        }
        // If a broad stage filter like "All Action Needed" is active, filter client-side
        if (currentStageDef.stageStatuses && currentStageDef.stageStatuses.length > 0) {
            return rawOrders.filter((o: any) => currentStageDef.stageStatuses?.includes(o.status));
        }
        return rawOrders;
    }, [rawOrders, currentChipDef, currentStageDef]);

    // Bulk actions
    const handleBulkDispatch = () => {
        bulkOrder.mutate(
            { ids: selectedOrders, action: "dispatch", data: { vehicleNumber: "BULK DISPATCH" } },
            { onSuccess: () => setSelectedOrders([]) }
        );
    };

    const handleBulkCancel = () => {
        bulkOrder.mutate(
            { ids: selectedOrders, action: "cancel" },
            { onSuccess: () => setSelectedOrders([]) }
        );
    };

    const handleBulkMarkPaid = () => {
        const toPay: OrderToPay[] = selectedOrders
            .map((id) => (orders as any[]).find((o: any) => o.id === id))
            .filter((order): order is any => {
                if (!order) return false;
                if (order.status === "CANCELLED" || order.status === "RETURNED") return false;
                const invBalance = order.invoice?.balanceAmount;
                if (invBalance != null && invBalance <= 0) return false;
                if (order.balanceAmount != null && order.balanceAmount <= 0) return false;
                return true;
            })
            .map((order) => ({
                id: order.id,
                orderNumber: order.orderNumber,
                customerName: (order.customer as any)?.name ?? "Customer",
                netAmount: Number(order.netAmount) || 0,
                paidAmount: Number(order.paidAmount) || 0,
                balanceAmount: Number(order.balanceAmount) || 0,
                invoiceBalance:
                    order.invoice?.balanceAmount != null
                        ? Number(order.invoice.balanceAmount)
                        : undefined,
            }));

        if (toPay.length === 0) {
            toast.error("All selected orders are already paid");
            return;
        }

        setOrdersToPay(toPay);
        setShowMarkPaidModal(true);
    };

    const handleSingleMarkPaid = (order: any) => {
        const single: OrderToPay = {
            id: order.id,
            orderNumber: order.orderNumber,
            customerName: (order.customer as any)?.name ?? "Customer",
            netAmount: Number(order.netAmount) || 0,
            paidAmount: Number(order.paidAmount) || 0,
            balanceAmount: Number(order.balanceAmount) || 0,
            invoiceBalance:
                order.invoice?.balanceAmount != null
                    ? Number(order.invoice.balanceAmount)
                    : undefined,
        };
        setOrdersToPay([single]);
        setShowMarkPaidModal(true);
    };

    const toggleSelection = (id: string) => {
        setSelectedOrders((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const canDispatch =
        selectedOrders.length > 0 &&
        selectedOrders.every((id) => {
            const order = Array.isArray(orders) ? orders.find((o: any) => o.id === id) : null;
            return (
                order &&
                !["DISPATCHED", "DELIVERED", "CANCELLED", "RETURNED"].includes(
                    order.status as string
                )
            );
        });

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) setSelectedOrders(orders.map((o: any) => o.id as string));
        else setSelectedOrders([]);
    };

    // Row density styling helpers
    const rowClass =
        density === "compact"
            ? "py-1.5 px-3 text-xs" // ~32px compact row height
            : "py-3 px-4 text-sm"; // ~44px default row height

    const headClass =
        density === "compact"
            ? "py-2 px-3 text-[11px] font-semibold"
            : "py-3.5 px-4 text-xs font-semibold";

    return (
        <div className="space-y-4">
            {/* ─── HEADER BAR ─────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        {t("orders")}
                    </h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        High-velocity wholesale billing, beat dispatches & payment reconciliation
                    </p>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1 sm:pb-0 flex-nowrap shrink-0">
                    <button
                        onClick={() => setShowImport(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition font-medium whitespace-nowrap shadow-xs"
                    >
                        <FileSpreadsheet size={14} className="text-blue-500" /> Import
                    </button>
                    <button
                        onClick={() => exportToCSV("orders-export", orders)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition font-medium whitespace-nowrap shadow-xs"
                    >
                        <Download size={14} /> Export CSV
                    </button>
                    <Link
                        href="/orders/new"
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition whitespace-nowrap shadow-xs"
                    >
                        <Plus size={15} /> {t("new_order")}
                    </Link>
                </div>
            </div>

            {/* ─── 4-STAGE ACTIONABLE PIPELINE TABS ───────────────── */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-1.5 shadow-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                    {PIPELINE_STAGES.map((s) => {
                        const Icon = s.icon;
                        const isActive = stage === s.id;
                        return (
                            <button
                                key={s.id}
                                onClick={() => handleStageChange(s.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                                    isActive
                                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 shadow-xs"
                                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border border-transparent"
                                }`}
                            >
                                <Icon size={15} className={isActive ? "text-blue-600 dark:text-blue-400" : "text-zinc-400"} />
                                <div className="truncate">
                                    <div className="font-semibold leading-tight">{s.label}</div>
                                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate hidden sm:block">
                                        {s.description}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Sub-Filter Chips for Current Stage */}
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 overflow-x-auto no-scrollbar">
                    <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 pl-1 pr-1.5 shrink-0 flex items-center gap-1">
                        Filters:
                    </span>
                    {currentStageDef.chips.map((chip) => {
                        const isChipActive = activeChip === chip.id;
                        return (
                            <button
                                key={chip.id}
                                onClick={() => handleChipChange(chip.id)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                                    isChipActive
                                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-200"
                                }`}
                            >
                                {chip.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ─── SEARCH & ROW DENSITY TOOLBAR ───────────────────── */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                    <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                    />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by customer name or #ORD..."
                        className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none transition shadow-xs"
                    />
                </div>

                {/* Density Toggle (32px vs 44px) */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1 mr-1">
                        <SlidersHorizontal size={12} /> Density:
                    </span>
                    <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-0.5">
                        <button
                            type="button"
                            onClick={() => handleDensityChange("default")}
                            title="Default Density (44px row height)"
                            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition ${
                                density === "default"
                                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                            }`}
                        >
                            <Maximize2 size={11} /> 44px
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDensityChange("compact")}
                            title="Compact Density (32px row height, maximum data visibility)"
                            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition ${
                                density === "compact"
                                    ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs"
                                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                            }`}
                        >
                            <Minimize2 size={11} /> 32px Compact
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── MOBILE VIEW (< md) ─────────────────────────────── */}
            <div className="block md:hidden space-y-2.5">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={i}
                            className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse h-28"
                        />
                    ))
                ) : orders.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                        <Package size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="font-medium text-sm mb-1">{t("no_orders_found")}</p>
                        <Link
                            href="/orders/new"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                        >
                            {t("create_first_order")}
                        </Link>
                    </div>
                ) : (
                    orders.map((order: any) => {
                        const net = Number(order.netAmount) || 0;
                        const custPhone =
                            order.customer?.whatsappNumber ||
                            order.customer?.phone ||
                            order.customer?.altPhone;

                        return (
                            <div
                                key={order.id}
                                className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition space-y-2 shadow-xs"
                            >
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/orders/${order.id}`}
                                            className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            {order.orderNumber}
                                        </Link>
                                        <StatusBadge status={order.status} />
                                    </div>
                                    <span className="text-[11px] text-zinc-400 tabular-nums">
                                        {formatDate(order.createdAt)}
                                    </span>
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                        {order.customer?.name ?? "Customer"}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500">
                                        <SourceBadge source={order.source} />
                                        {Boolean(order.invoiceId) && <span>• Invoice generated</span>}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                                    <div>
                                        <span className="text-[10px] text-zinc-400 block">Total Amount</span>
                                        <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100 tabular-nums">
                                            {formatINR(net)}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <PaymentBadge order={order} />
                                        {order.status !== "CANCELLED" &&
                                            order.status !== "RETURNED" &&
                                            order.status !== "DRAFT" &&
                                            order.invoiceId &&
                                            custPhone && (
                                                <a
                                                    href={buildWhatsAppInvoiceLink({
                                                        customerPhone: custPhone,
                                                        customerName: order.customer?.name ?? "Customer",
                                                        invoiceNumber: order.orderNumber,
                                                        invoiceAmount: order.netAmount,
                                                        invoiceId: order.invoiceId,
                                                    })}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition"
                                                >
                                                    <Send size={11} className="inline mr-1" /> WA
                                                </a>
                                            )}
                                        <Link
                                            href={`/orders/${order.id}`}
                                            className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                                        >
                                            View →
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ─── DESKTOP TABLE SYSTEM (md+) ─────────────────────── */}
            <div className="hidden md:block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                <th className={`${headClass} w-10 text-center`}>
                                    <input
                                        type="checkbox"
                                        onChange={handleSelectAll}
                                        checked={orders.length > 0 && selectedOrders.length === orders.length}
                                        className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-700 accent-blue-600 cursor-pointer"
                                    />
                                </th>
                                <th className={`${headClass} min-w-[130px]`}>{t("order_hash")}</th>
                                <th className={`${headClass} min-w-[170px]`}>{t("customer")}</th>
                                <th className={`${headClass} min-w-[105px]`}>{t("date")}</th>
                                <th className={`${headClass} text-right min-w-[110px]`}>{t("amount")}</th>
                                <th className={`${headClass} text-center min-w-[95px]`}>Payment</th>
                                <th className={`${headClass} text-center min-w-[85px]`}>Source</th>
                                <th className={`${headClass} text-center min-w-[120px]`}>{t("status")}</th>
                                <th className={`${headClass} text-right min-w-[140px]`}>{t("actions")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                            {isLoading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan={9} className="p-3">
                                            <div className="h-5 bg-zinc-100 dark:bg-zinc-800/60 rounded animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center">
                                        <Package size={36} className="mx-auto mb-3 opacity-20 text-zinc-400" />
                                        <p className="text-zinc-500 font-medium mb-1">{t("no_orders_found")}</p>
                                        <Link
                                            href="/orders/new"
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                                        >
                                            {t("create_first_order")}
                                        </Link>
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order: any) => {
                                    const net = Number(order.netAmount) || 0;
                                    const isSelected = selectedOrders.includes(order.id);
                                    const custPhone =
                                        order.customer?.whatsappNumber ||
                                        order.customer?.phone ||
                                        order.customer?.altPhone;

                                    return (
                                        <tr
                                            key={order.id}
                                            className={`transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 ${
                                                isSelected ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                                            }`}
                                        >
                                            <td className={`${rowClass} text-center`}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelection(order.id)}
                                                    className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-700 accent-blue-600 cursor-pointer"
                                                />
                                            </td>
                                            <td className={`${rowClass} font-mono font-medium`}>
                                                <Link
                                                    href={`/orders/${order.id}`}
                                                    className="text-blue-600 dark:text-blue-400 hover:underline tracking-tight"
                                                >
                                                    {order.orderNumber}
                                                </Link>
                                            </td>
                                            <td className={`${rowClass} font-medium text-zinc-900 dark:text-zinc-100`}>
                                                <span className="truncate max-w-[200px] inline-block align-middle" title={order.customer?.name}>
                                                    {order.customer?.name ?? "—"}
                                                </span>
                                            </td>
                                            <td className={`${rowClass} text-zinc-500 dark:text-zinc-400 tabular-nums font-mono text-[11px]`}>
                                                {formatDate(order.createdAt)}
                                            </td>
                                            <td className={`${rowClass} text-right font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100`}>
                                                {formatINR(net)}
                                            </td>
                                            <td className={`${rowClass} text-center`}>
                                                <PaymentBadge order={order} />
                                            </td>
                                            <td className={`${rowClass} text-center`}>
                                                <SourceBadge source={order.source} />
                                            </td>
                                            <td className={`${rowClass} text-center`}>
                                                <StatusBadge status={order.status} />
                                            </td>
                                            <td className={`${rowClass} text-right`}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {order.status !== "CANCELLED" &&
                                                        order.status !== "RETURNED" &&
                                                        order.status !== "DRAFT" &&
                                                        order.invoiceId &&
                                                        custPhone && (
                                                            <a
                                                                href={buildWhatsAppInvoiceLink({
                                                                    customerPhone: custPhone,
                                                                    customerName: order.customer?.name ?? "Customer",
                                                                    invoiceNumber: order.orderNumber,
                                                                    invoiceAmount: order.netAmount,
                                                                    invoiceId: order.invoiceId,
                                                                })}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition font-medium"
                                                                title="Send invoice via WhatsApp"
                                                            >
                                                                <Send size={11} /> WA
                                                            </a>
                                                        )}
                                                    {order.status !== "CANCELLED" &&
                                                        order.status !== "RETURNED" &&
                                                        order.status !== "DRAFT" &&
                                                        (order.invoice?.balanceAmount == null ||
                                                            order.invoice?.balanceAmount > 0) &&
                                                        (order.paidAmount == null ||
                                                            order.paidAmount < order.netAmount) && (
                                                            <button
                                                                onClick={() => handleSingleMarkPaid(order)}
                                                                className="inline-flex items-center text-[11px] px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-emerald-600 dark:text-emerald-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition font-medium"
                                                            >
                                                                Pay
                                                            </button>
                                                        )}
                                                    <Link
                                                        href={`/orders/${order.id}`}
                                                        className="text-[11px] px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition font-medium"
                                                    >
                                                        {t("view")}
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {meta.pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                            Showing page {page} of {meta.pages} ({meta.total} orders total)
                        </p>
                        <div className="flex gap-1">
                            {Array.from({ length: Math.min(meta.pages, 5) }, (_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setPage(i + 1)}
                                    className={`w-7 h-7 rounded text-xs font-medium tabular-nums transition ${
                                        page === i + 1
                                            ? "bg-blue-600 text-white shadow-xs"
                                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    }`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── FLOATING BULK ACTIONS TOOLBAR ──────────────────── */}
            {selectedOrders.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 dark:bg-zinc-950 text-white border border-zinc-800 shadow-2xl rounded-full px-5 py-2.5 flex items-center gap-4 animate-in slide-in-from-bottom-5 fade-in duration-200">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center bg-blue-600 text-white w-5 h-5 rounded-full text-[11px] font-bold tabular-nums">
                            {selectedOrders.length}
                        </span>
                        <span className="text-xs font-medium">Selected</span>
                    </div>
                    <div className="w-px h-4 bg-zinc-700" />
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handleBulkDispatch}
                            disabled={!canDispatch || bulkOrder.isPending}
                            className="text-xs px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                        >
                            {bulkOrder.isPending ? "..." : "Dispatch"}
                        </button>
                        <button
                            onClick={handleBulkMarkPaid}
                            disabled={bulkOrder.isPending}
                            className="text-xs px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition disabled:opacity-40 shadow-xs"
                        >
                            {bulkOrder.isPending ? "..." : "Mark Paid"}
                        </button>
                        <button
                            onClick={handleBulkCancel}
                            disabled={bulkOrder.isPending}
                            className="text-xs px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-rose-400 font-medium transition disabled:opacity-40"
                        >
                            {bulkOrder.isPending ? "..." : "Cancel"}
                        </button>
                        <button
                            onClick={() => setSelectedOrders([])}
                            className="ml-1.5 text-zinc-400 hover:text-white p-1"
                            title="Clear selection"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* ─── MODALS ─────────────────────────────────────────── */}
            <ExcelImportModal
                isOpen={showImport}
                onClose={() => setShowImport(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["orders"] });
                }}
                type="orders"
            />

            <MarkPaidModal
                open={showMarkPaidModal}
                onClose={() => setShowMarkPaidModal(false)}
                orders={ordersToPay}
                onSuccess={() => {
                    setSelectedOrders([]);
                    queryClient.invalidateQueries({ queryKey: ["orders"] });
                    queryClient.invalidateQueries({ queryKey: ["customers"] });
                }}
            />
        </div>
    );
}
