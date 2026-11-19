"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Search,
    PlusCircle,
    CreditCard,
    Users,
    Package,
    FileText,
    ShoppingCart,
    LayoutDashboard,
    Truck,
    Settings,
    Receipt,
    Loader2,
    ArrowRight,
    CornerDownLeft,
    Tag,
    Building2,
    Clock,
} from "lucide-react";
import type { NavGroup } from "./sidebar";
import apiClient from "@/lib/api-client";
import { formatINR, formatDate } from "@/lib/utils";

export interface SearchModalProps {
    open: boolean;
    onClose: () => void;
    navGroups?: NavGroup[];
}

interface CommandItem {
    id: string;
    section: "Actions" | "Navigation" | "Customers" | "Products" | "Invoices";
    title: string;
    subtitle?: string;
    badge?: string;
    icon: React.ElementType;
    shortcut?: string;
    onSelect: () => void;
    keywords?: string[];
}

export function SearchModal({ open, onClose, navGroups = [] }: SearchModalProps) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isSearchingRemote, setIsSearchingRemote] = useState(false);

    // Live remote search results
    const [remoteCustomers, setRemoteCustomers] = useState<any[]>([]);
    const [remoteProducts, setRemoteProducts] = useState<any[]>([]);
    const [remoteInvoices, setRemoteInvoices] = useState<any[]>([]);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Reset query & focus input whenever modal opens
    useEffect(() => {
        if (open) {
            setQuery("");
            setSelectedIndex(0);
            setRemoteCustomers([]);
            setRemoteProducts([]);
            setRemoteInvoices([]);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [open]);

    // Global keyboard listener for quick shortcuts (Alt+N, Alt+P, etc.)
    useEffect(() => {
        const globalHandler = (e: KeyboardEvent) => {
            // Check for Alt+N -> Quick New Order
            if (e.altKey && (e.key === "n" || e.key === "N")) {
                e.preventDefault();
                router.push("/orders/new");
                if (open) onClose();
                return;
            }
            // Check for Alt+P -> Quick Record Payment
            if (e.altKey && (e.key === "p" || e.key === "P")) {
                e.preventDefault();
                router.push("/payments");
                if (open) onClose();
                return;
            }
        };

        window.addEventListener("keydown", globalHandler);
        return () => window.removeEventListener("keydown", globalHandler);
    }, [open, onClose, router]);

    // Debounced remote API search when query is typed
    useEffect(() => {
        if (!open) return;

        const trimmed = query.trim();
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        if (trimmed.length < 2) {
            setRemoteCustomers([]);
            setRemoteProducts([]);
            setRemoteInvoices([]);
            setIsSearchingRemote(false);
            return;
        }

        setIsSearchingRemote(true);
        debounceTimerRef.current = setTimeout(async () => {
            try {
                const [custRes, prodRes, invRes] = await Promise.allSettled([
                    apiClient.get("/api/v1/customers", { params: { search: trimmed, limit: 4 } }),
                    apiClient.get("/api/v1/products", { params: { search: trimmed, limit: 4 } }),
                    apiClient.get("/api/v1/invoices", { params: { search: trimmed, limit: 4 } }),
                ]);

                if (custRes.status === "fulfilled") {
                    const data = custRes.value?.data;
                    const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
                    setRemoteCustomers(list);
                } else {
                    setRemoteCustomers([]);
                }

                if (prodRes.status === "fulfilled") {
                    const data = prodRes.value?.data;
                    const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
                    setRemoteProducts(list);
                } else {
                    setRemoteProducts([]);
                }

                if (invRes.status === "fulfilled") {
                    const data = invRes.value?.data;
                    const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
                    setRemoteInvoices(list);
                } else {
                    setRemoteInvoices([]);
                }
            } catch (err) {
                console.error("Command palette search error:", err);
            } finally {
                setIsSearchingRemote(false);
            }
        }, 180);

        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, [query, open]);

    // Built-in Quick Actions
    const quickActions = useMemo<CommandItem[]>(() => [
        {
            id: "action-new-order",
            section: "Actions",
            title: "Create New Order / Bill",
            subtitle: "Rapid keyboard-first invoice punching",
            shortcut: "Alt+N",
            icon: PlusCircle,
            keywords: ["bill", "order", "invoice", "sale", "nayi bill", "parcha"],
            onSelect: () => router.push("/orders/new"),
        },
        {
            id: "action-record-payment",
            section: "Actions",
            title: "Record Payment / Khata Entry",
            subtitle: "Cash, UPI, or Cheque collection match",
            shortcut: "Alt+P",
            icon: CreditCard,
            keywords: ["payment", "vasooli", "collection", "upi", "cheque", "jama"],
            onSelect: () => router.push("/payments"),
        },
        {
            id: "action-view-outstanding",
            section: "Actions",
            title: "View Outstanding Receivables (DSO)",
            subtitle: "Retailer balances & WhatsApp reminders",
            icon: Receipt,
            keywords: ["outstanding", "khata", "due", "udhaar", "dso", "ledger"],
            onSelect: () => router.push("/payments?tab=outstanding"),
        },
        {
            id: "action-add-customer",
            section: "Actions",
            title: "Add New Retailer / Customer",
            subtitle: "Onboard Kirana with GSTIN & Credit limit",
            icon: Users,
            keywords: ["customer", "retailer", "dukaan", "party", "kirana"],
            onSelect: () => router.push("/customers"),
        },
        {
            id: "action-manage-inventory",
            section: "Actions",
            title: "Inventory & Stock Adjustment",
            subtitle: "Check batches, near-expiry & dump stock",
            icon: Package,
            keywords: ["inventory", "stock", "godown", "batch", "expiry", "maal"],
            onSelect: () => router.push("/inventory"),
        },
        {
            id: "action-tally-sync",
            section: "Actions",
            title: "Tally & Marg Bridge Status",
            subtitle: "Sync ledgers, offline vouchers & vouchers queue",
            icon: Settings,
            keywords: ["tally", "marg", "sync", "export", "settings", "bridge"],
            onSelect: () => router.push("/settings"),
        },
    ], [router]);

    // Navigation items flattened from navGroups
    const navigationItems = useMemo<CommandItem[]>(() => {
        return navGroups.flatMap((group) =>
            group.items.map((item) => ({
                id: `nav-${item.href}`,
                section: "Navigation" as const,
                title: item.label.charAt(0).toUpperCase() + item.label.slice(1).replace(/_/g, " "),
                subtitle: item.href,
                icon: item.icon || LayoutDashboard,
                keywords: [item.label, item.href],
                onSelect: () => router.push(item.href),
            }))
        );
    }, [navGroups, router]);

    // Format Remote Customers
    const customerItems = useMemo<CommandItem[]>(() => {
        return remoteCustomers.map((c) => ({
            id: `cust-${c.id}`,
            section: "Customers",
            title: c.name || c.businessName || "Retailer",
            subtitle: [c.phone, c.city, c.gstin ? `GST: ${c.gstin}` : null].filter(Boolean).join(" • "),
            badge: c.paymentScore ? `${c.paymentScore} pts` : (c.creditLimit ? `Limit: ${formatINR(c.creditLimit)}` : undefined),
            icon: Users,
            keywords: [c.name, c.phone, c.gstin, c.city].filter(Boolean),
            onSelect: () => router.push(`/customers/${c.id}`),
        }));
    }, [remoteCustomers, router]);

    // Format Remote Products
    const productItems = useMemo<CommandItem[]>(() => {
        return remoteProducts.map((p) => {
            const stock = p.stock ?? p.currentStock ?? 0;
            return {
                id: `prod-${p.id}`,
                section: "Products",
                title: p.name,
                subtitle: [p.sku ? `SKU: ${p.sku}` : null, p.category, `Stock: ${stock}`].filter(Boolean).join(" • "),
                badge: p.price ? formatINR(p.price) : undefined,
                icon: Package,
                keywords: [p.name, p.sku, p.category].filter(Boolean),
                onSelect: () => router.push(`/inventory?search=${encodeURIComponent(p.name)}`),
            };
        });
    }, [remoteProducts, router]);

    // Format Remote Invoices
    const invoiceItems = useMemo<CommandItem[]>(() => {
        return remoteInvoices.map((inv) => ({
            id: `inv-${inv.id}`,
            section: "Invoices",
            title: inv.invoiceNumber || inv.orderNumber || "Invoice",
            subtitle: [inv.customer?.name || inv.customerName, formatDate(inv.createdAt)].filter(Boolean).join(" • "),
            badge: inv.totalAmount ? formatINR(inv.totalAmount) : inv.status,
            icon: FileText,
            keywords: [inv.invoiceNumber, inv.orderNumber, inv.customer?.name].filter(Boolean),
            onSelect: () => router.push(`/invoices/${inv.id}`),
        }));
    }, [remoteInvoices, router]);

    // Filter items based on local search query
    const filteredItems = useMemo<CommandItem[]>(() => {
        const q = query.trim().toLowerCase();
        if (!q) {
            // When query is empty, show all Actions and primary Navigation
            return [...quickActions, ...navigationItems];
        }

        const matchItem = (item: CommandItem) => {
            if (item.title.toLowerCase().includes(q)) return true;
            if (item.subtitle?.toLowerCase().includes(q)) return true;
            if (item.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
            return false;
        };

        const matchedActions = quickActions.filter(matchItem);
        const matchedNav = navigationItems.filter(matchItem);

        return [
            ...matchedActions,
            ...matchedNav,
            ...customerItems,
            ...productItems,
            ...invoiceItems,
        ];
    }, [query, quickActions, navigationItems, customerItems, productItems, invoiceItems]);

    // Group items by Section for categorized rendering
    const groupedItems = useMemo(() => {
        const groups: { [key: string]: CommandItem[] } = {};
        for (const item of filteredItems) {
            if (!groups[item.section]) {
                groups[item.section] = [];
            }
            groups[item.section].push(item);
        }
        return groups;
    }, [filteredItems]);

    // Reset selection index when list changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [filteredItems.length]);

    // Ensure highlighted item is scrolled into view
    useEffect(() => {
        if (!listRef.current) return;
        const activeEl = listRef.current.querySelector<HTMLElement>('[data-selected="true"]');
        if (activeEl) {
            activeEl.scrollIntoView({ block: "nearest" });
        }
    }, [selectedIndex]);

    // Handle keydown for navigation, select, escape
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (filteredItems.length === 0) return;
                setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (filteredItems.length === 0) return;
                setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
            } else if (e.key === "Enter") {
                e.preventDefault();
                const item = filteredItems[selectedIndex];
                if (item) {
                    item.onSelect();
                    onClose();
                }
            } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        },
        [filteredItems, selectedIndex, onClose]
    );

    if (!open) return null;

    let runningIndex = -1;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input Bar */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800 bg-zinc-900/90">
                    <Search size={18} className="text-zinc-400 shrink-0" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search bills, customers, SKUs, or type an action..."
                        className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
                    />
                    {isSearchingRemote && (
                        <Loader2 size={16} className="text-zinc-400 animate-spin shrink-0" />
                    )}
                    <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 text-zinc-400">
                        ESC
                    </kbd>
                </div>

                {/* Results List */}
                <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-4">
                    {filteredItems.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500">
                            <p className="text-sm">No results found for &ldquo;{query}&rdquo;</p>
                            <p className="text-xs text-zinc-600 mt-1">
                                Try searching for customer names, bill numbers, or press Alt+N for a new order.
                            </p>
                        </div>
                    ) : (
                        Object.entries(groupedItems).map(([section, items]) => (
                            <div key={section} className="space-y-1">
                                <div className="text-[11px] font-mono tracking-wider font-semibold text-zinc-500 uppercase px-3 py-1">
                                    {section}
                                </div>
                                {items.map((item) => {
                                    runningIndex++;
                                    const currentIndex = runningIndex;
                                    const isSelected = selectedIndex === currentIndex;
                                    const Icon = item.icon;

                                    return (
                                        <div
                                            key={item.id}
                                            data-selected={isSelected}
                                            onClick={() => {
                                                item.onSelect();
                                                onClose();
                                            }}
                                            onMouseEnter={() => setSelectedIndex(currentIndex)}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer select-none ${
                                                isSelected
                                                    ? "bg-zinc-800 text-zinc-100"
                                                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className={`p-1.5 rounded-md shrink-0 ${
                                                        isSelected
                                                            ? "bg-blue-600/20 text-blue-400"
                                                            : "bg-zinc-800 text-zinc-400"
                                                    }`}
                                                >
                                                    <Icon size={16} />
                                                </div>
                                                <div className="min-w-0 text-left">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-zinc-200 truncate">
                                                            {item.title}
                                                        </span>
                                                        {item.badge && (
                                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-700/60 border border-zinc-600/40 text-zinc-300 shrink-0">
                                                                {item.badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.subtitle && (
                                                        <p className="text-xs text-zinc-500 truncate mt-0.5">
                                                            {item.subtitle}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 ml-3">
                                                {item.shortcut && (
                                                    <kbd className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 text-zinc-400">
                                                        {item.shortcut}
                                                    </kbd>
                                                )}
                                                {isSelected && (
                                                    <CornerDownLeft size={14} className="text-zinc-400" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* Linear/Stripe-tier Footer Bar */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800 bg-zinc-950/60 text-xs text-zinc-500 font-mono">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 text-[10px] text-zinc-400">↑↓</kbd> Navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 text-[10px] text-zinc-400">↵</kbd> Open
                        </span>
                    </div>
                    <div className="hidden sm:flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 text-[10px] text-zinc-400">Alt+N</kbd> New Bill
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 text-[10px] text-zinc-400">Alt+P</kbd> Payment
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
