"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Plus,
    Trash2,
    Search,
    Package,
    ArrowDownAZ,
    ArrowUpZA,
    AlertCircle,
    Check,
    ChevronDown,
    CornerDownLeft,
    Sparkles,
    X,
} from "lucide-react";
import { useCreateOrder, useCustomers, useProducts, useWarehouses } from "@/hooks/api-hooks";
import { AddCustomerModal } from "@/components/AddCustomerModal";
import { formatINR } from "@/lib/utils";

export interface OrderItemRow {
    rowId: string;
    productId: string;
    variantId?: string;
    productName: string;
    quantity: number;
    unit: string;
    price: number;
    discount: number;
    taxRate: number;
    stock: number;
    searchQuery?: string;
    isDropdownOpen?: boolean;
}

interface SearchableProductOption {
    productId: string;
    variantId?: string;
    displayName: string;
    sku: string;
    unit: string;
    price: number;
    taxRate: number;
    stock: number;
}

const createEmptyRow = (rowId = `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`): OrderItemRow => ({
    rowId,
    productId: "",
    productName: "",
    quantity: 1,
    unit: "Pcs",
    price: 0,
    discount: 0,
    taxRate: 0,
    stock: 0,
    searchQuery: "",
    isDropdownOpen: false,
});

export default function NewOrderPage() {
    const router = useRouter();
    const createOrder = useCreateOrder();

    const [orderType, setOrderType] = useState<"B2B" | "B2C">("B2B");
    const [customerId, setCustomerId] = useState("");
    const [customerSearch, setCustomerSearch] = useState("");
    const [showAddCustomer, setShowAddCustomer] = useState(false);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [customerSort, setCustomerSort] = useState<"asc" | "desc">("asc");
    const [customerHighlightIndex, setCustomerHighlightIndex] = useState(0);

    const { data: whData } = useWarehouses();
    const warehouses = Array.isArray(whData) ? whData : (whData?.data ?? []);

    const [warehouseId, setWarehouseId] = useState("");
    const [notes, setNotes] = useState("");
    const [deliveryDate, setDeliveryDate] = useState("");

    // Commission state
    const [showCommission, setShowCommission] = useState(false);
    const [commissionTo, setCommissionTo] = useState("");
    const [commissionToCustom, setCommissionToCustom] = useState("");
    const [commissionType, setCommissionType] = useState<"FIXED" | "PERCENTAGE">("FIXED");
    const [commissionValue, setCommissionValue] = useState<number>(0);

    // Credit limit override state
    const [overrideCreditLimit, setOverrideCreditLimit] = useState(false);
    const [overrideReason, setOverrideReason] = useState("");

    // Line items with initial empty row ready for typing
    const [items, setItems] = useState<OrderItemRow[]>([createEmptyRow("row-initial")]);
    const [activeRowHighlight, setActiveRowHighlight] = useState<number>(0);

    // Form submission reference for keyboard shortcut
    const submitButtonRef = useRef<HTMLButtonElement | null>(null);
    const customerInputRef = useRef<HTMLInputElement | null>(null);

    // Dynamic input refs for grid cell navigation
    const productInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
    const qtyInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
    const rateInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
    const discountInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

    // Fetch customers
    const { data: customersData } = useCustomers({ search: customerSearch.trim() || undefined, limit: 100 });
    const customersRaw = customersData?.data ?? [];
    const customers = useMemo(() => {
        const list = [...customersRaw];
        list.sort((a: any, b: any) => {
            const nameA = ((a.name as string) ?? "").toLowerCase();
            const nameB = ((b.name as string) ?? "").toLowerCase();
            return customerSort === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
        return list;
    }, [customersRaw, customerSort]);

    // Fetch products
    const { data: prodData } = useProducts({ limit: 200, isActive: true, isDraft: false });
    const products = prodData?.data?.data ?? prodData?.data ?? [];

    // Flatten products and variants into instant-search lookup
    const searchableProductOptions = useMemo(() => {
        const list: SearchableProductOption[] = [];
        const prods = Array.isArray(products) ? products : [];
        for (const p of prods) {
            if (p.hasVariants && Array.isArray(p.variants) && p.variants.length > 0) {
                for (const v of p.variants) {
                    const vStock = Array.isArray(v.inventories)
                        ? v.inventories.reduce((sum: number, inv: any) => sum + (inv.quantity - inv.reservedQty), 0)
                        : 0;
                    list.push({
                        productId: p.id,
                        variantId: v.id,
                        displayName: `${p.name} (${v.name})`,
                        sku: v.sku || p.sku || "",
                        unit: p.unit || "Pieces",
                        price: (v.sellingPrice as number) ?? ((p.sellingPrice as number) ?? 0),
                        taxRate: (p.gstRate as number) ?? 0,
                        stock: vStock,
                    });
                }
            } else {
                list.push({
                    productId: p.id,
                    displayName: p.name,
                    sku: p.sku || "",
                    unit: p.unit || "Pieces",
                    price: (p.sellingPrice as number) ?? 0,
                    taxRate: (p.gstRate as number) ?? 0,
                    stock: (p.totalQuantity as number) ?? 0,
                });
            }
        }
        return list;
    }, [products]);

    useEffect(() => {
        if (warehouses.length === 1 && !warehouseId) setWarehouseId(warehouses[0].id);
    }, [warehouses, warehouseId]);

    // Global keyboard listener for Ctrl+Enter / Cmd+Enter rapid order completion
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                submitButtonRef.current?.click();
            }
        };
        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, []);

    const selectedCustomer = useMemo(() => {
        return (customersRaw as any[]).find((c: any) => c.id === customerId);
    }, [customersRaw, customerId]);

    // ── Price & Tax Math ──
    const subtotal = useMemo(() => {
        const raw = items.reduce((s, i) => {
            if (!i.productId) return s;
            if (orderType === "B2C") {
                const taxable = i.price / (1 + i.taxRate / 100);
                return s + (taxable * i.quantity) - i.discount;
            }
            return s + (i.price * i.quantity) - i.discount;
        }, 0);
        return Math.max(0, Math.round(raw * 100) / 100);
    }, [items, orderType]);

    const taxTotal = useMemo(() => {
        const raw = items.reduce((s, i) => {
            if (!i.productId) return s;
            if (orderType === "B2C") {
                const taxable = i.price / (1 + i.taxRate / 100);
                const lineBase = (taxable * i.quantity) - i.discount;
                return s + (lineBase * i.taxRate / 100);
            }
            const lineTotal = (i.price * i.quantity) - i.discount;
            return s + (lineTotal * i.taxRate / 100);
        }, 0);
        return Math.max(0, Math.round(raw * 100) / 100);
    }, [items, orderType]);

    const grandTotal = useMemo(() => {
        if (orderType === "B2C") {
            const raw = items.reduce((s, i) => {
                if (!i.productId) return s;
                return s + (i.price * i.quantity) - i.discount;
            }, 0);
            return Math.max(0, Math.round(raw * 100) / 100);
        }
        return Math.max(0, Math.round((subtotal + taxTotal) * 100) / 100);
    }, [items, orderType, subtotal, taxTotal]);

    const creditLimit = Number(selectedCustomer?.creditLimit || 0);
    const currentOutstanding = Number(selectedCustomer?.outstandingAmount || 0);
    const isCreditExceeded = creditLimit > 0 && (currentOutstanding + grandTotal) > creditLimit;
    const availableCredit = creditLimit > 0 ? Math.max(0, creditLimit - currentOutstanding) : Infinity;

    // Customer selection handler
    const handleSelectCustomer = (c: any) => {
        setCustomerId(c.id);
        setCustomerSearch(c.name);
        setShowCustomerDropdown(false);
        if (c.type === "INDIVIDUAL") {
            setOrderType("B2C");
        } else {
            setOrderType("B2B");
        }
        // Focus first row product search
        setTimeout(() => {
            const firstRowId = items[0]?.rowId;
            if (firstRowId) productInputRefs.current[firstRowId]?.focus();
        }, 50);
    };

    // Item row update helper
    const updateRow = (rowId: string, updates: Partial<OrderItemRow>) => {
        setItems(prev => prev.map(row => (row.rowId === rowId ? { ...row, ...updates } : row)));
    };

    // Select product into row and auto-advance to Qty
    const handleSelectProduct = (rowId: string, option: SearchableProductOption) => {
        setItems(prev =>
            prev.map(row => {
                if (row.rowId !== rowId) return row;
                return {
                    ...row,
                    productId: option.productId,
                    variantId: option.variantId,
                    productName: option.displayName,
                    unit: option.unit,
                    price: option.price,
                    taxRate: option.taxRate,
                    stock: option.stock,
                    searchQuery: option.displayName,
                    isDropdownOpen: false,
                };
            })
        );
        // Focus Qty input immediately
        setTimeout(() => {
            const qtyInput = qtyInputRefs.current[rowId];
            if (qtyInput) {
                qtyInput.focus();
                qtyInput.select();
            }
        }, 20);
    };

    // Remove row
    const handleRemoveRow = (rowId: string) => {
        setItems(prev => {
            const next = prev.filter(r => r.rowId !== rowId);
            if (next.length === 0) return [createEmptyRow()];
            return next;
        });
    };

    // Add new row manually or on Enter at end of line
    const handleAddNewRow = (focusNew = true) => {
        const newRow = createEmptyRow();
        setItems(prev => [...prev, newRow]);
        if (focusNew) {
            setTimeout(() => {
                productInputRefs.current[newRow.rowId]?.focus();
            }, 30);
        }
    };

    // Filter product options for a given row's query
    const getRowFilteredOptions = (query: string) => {
        if (!query || !query.trim()) return searchableProductOptions.slice(0, 15);
        const q = query.toLowerCase().trim();
        return searchableProductOptions
            .filter(opt => opt.displayName.toLowerCase().includes(q) || opt.sku.toLowerCase().includes(q))
            .slice(0, 20);
    };

    // Submit handler
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const validItems = items.filter(i => Boolean(i.productId));
        if (!customerId || validItems.length === 0) return;

        const resolvedCommissionTo =
            commissionTo === "Other"
                ? commissionToCustom.trim() || "Custom"
                : commissionToCustom.trim()
                ? `${commissionTo} (${commissionToCustom.trim()})`
                : commissionTo;

        const payload: Record<string, unknown> = {
            customerId,
            warehouseId: warehouseId || undefined,
            source: "WEB",
            notes: notes || undefined,
            deliveryDate: deliveryDate || undefined,
            overrideCreditLimit: overrideCreditLimit || undefined,
            overrideReason: overrideCreditLimit ? overrideReason.trim() || "Manager override" : undefined,
            ...(showCommission && resolvedCommissionTo && commissionValue > 0
                ? {
                      commissionTo: resolvedCommissionTo,
                      commissionType,
                      commissionValue,
                  }
                : {}),
            items: validItems.map(i => ({
                productId: i.productId,
                variantId: i.variantId || undefined,
                quantity: i.quantity,
                unit: i.unit,
                price: orderType === "B2C" ? parseFloat((i.price / (1 + i.taxRate / 100)).toFixed(2)) : i.price,
                discount: i.discount,
            })),
        };

        if (!payload.warehouseId) delete payload.warehouseId;

        createOrder.mutate(payload, {
            onSuccess: (res: any) => {
                const newId = res?.id || res?.data?.id;
                router.push(newId ? `/orders/${newId}` : "/orders");
            },
        });
    };

    const validItemsCount = items.filter(i => Boolean(i.productId)).length;

    return (
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
            {/* Header with Title, Mode Toggle & Keyboard Shortcut Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
                <div className="flex items-center gap-3">
                    <Link
                        href="/orders"
                        className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                    >
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
                            New Sales Order
                            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono rounded bg-blue-950/60 border border-blue-800/60 text-blue-400 font-medium">
                                <Sparkles size={11} /> Rapid Grid Mode
                            </span>
                        </h1>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Keyboard-first bill entry. Use <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[10px] text-zinc-300">Enter</kbd> to step through cells, <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[10px] text-zinc-300">Ctrl+Enter</kbd> to save.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* B2B / B2C Toggle */}
                    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 w-full sm:w-60">
                        <button
                            type="button"
                            onClick={() => setOrderType("B2B")}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
                                orderType === "B2B"
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            B2B (GST Breakup)
                        </button>
                        <button
                            type="button"
                            onClick={() => setOrderType("B2C")}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
                                orderType === "B2C"
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            B2C (Final Rate)
                        </button>
                    </div>

                    {/* Quick Save Hint Button */}
                    <button
                        type="button"
                        onClick={() => submitButtonRef.current?.click()}
                        disabled={!customerId || validItemsCount === 0 || createOrder.isPending || (isCreditExceeded && !overrideCreditLimit)}
                        className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 transition"
                    >
                        <kbd className="px-1 py-0.2 bg-zinc-950 border border-zinc-700 rounded text-[10px] font-mono text-zinc-400">Ctrl</kbd>
                        <span>+</span>
                        <kbd className="px-1 py-0.2 bg-zinc-950 border border-zinc-700 rounded text-[10px] font-mono text-zinc-400">Enter</kbd>
                        <span>Save</span>
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-6">
                {/* Customer Selection Card */}
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 sm:p-5 backdrop-blur-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                            Customer / Kirana Account <span className="text-rose-500">*</span>
                        </label>
                        {customerId && (
                            <button
                                type="button"
                                onClick={() => {
                                    setCustomerId("");
                                    setCustomerSearch("");
                                    setShowCustomerDropdown(true);
                                    setOverrideCreditLimit(false);
                                    setTimeout(() => customerInputRef.current?.focus(), 30);
                                }}
                                className="text-xs text-blue-400 hover:text-blue-300 transition"
                            >
                                Change Customer
                            </button>
                        )}
                    </div>

                    {!customerId ? (
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                ref={customerInputRef}
                                value={customerSearch}
                                onChange={e => {
                                    setCustomerSearch(e.target.value);
                                    setShowCustomerDropdown(true);
                                    setCustomerHighlightIndex(0);
                                }}
                                onFocus={() => setShowCustomerDropdown(true)}
                                onKeyDown={e => {
                                    if (e.key === "ArrowDown") {
                                        e.preventDefault();
                                        setCustomerHighlightIndex(i => Math.min(i + 1, customers.length - 1));
                                    } else if (e.key === "ArrowUp") {
                                        e.preventDefault();
                                        setCustomerHighlightIndex(i => Math.max(i - 1, 0));
                                    } else if (e.key === "Enter") {
                                        e.preventDefault();
                                        if (customers[customerHighlightIndex]) {
                                            handleSelectCustomer(customers[customerHighlightIndex]);
                                        }
                                    } else if (e.key === "Escape") {
                                        setShowCustomerDropdown(false);
                                    }
                                }}
                                placeholder="Search customer by store name, phone or GSTIN... (Press ↓ to browse)"
                                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 focus:outline-none transition font-sans"
                            />

                            {showCustomerDropdown && (
                                <div
                                    className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-72"
                                >
                                    <div className="flex items-center justify-between px-3.5 py-2 border-b border-zinc-800 bg-zinc-950/50">
                                        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold font-mono">
                                            {customers.length} accounts found
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setCustomerSort(customerSort === "asc" ? "desc" : "asc")}
                                            className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-blue-400 transition"
                                        >
                                            {customerSort === "asc" ? <ArrowDownAZ size={13} /> : <ArrowUpZA size={13} />}
                                            {customerSort === "asc" ? "A → Z" : "Z → A"}
                                        </button>
                                    </div>

                                    {customers.length === 0 ? (
                                        <div className="p-4 text-center space-y-2">
                                            <p className="text-xs text-zinc-500">No matching customer found</p>
                                            <button
                                                type="button"
                                                onClick={() => setShowAddCustomer(true)}
                                                className="text-xs font-medium text-blue-400 hover:underline"
                                            >
                                                + Add New Customer
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="overflow-y-auto divide-y divide-zinc-800/40">
                                            {customers.map((c: any, idx: number) => {
                                                const isHighlighted = idx === customerHighlightIndex;
                                                return (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => handleSelectCustomer(c)}
                                                        onMouseEnter={() => setCustomerHighlightIndex(idx)}
                                                        className={`w-full text-left px-3.5 py-2.5 text-xs transition flex items-center justify-between ${
                                                            isHighlighted
                                                                ? "bg-blue-600/15 text-blue-200"
                                                                : "text-zinc-300 hover:bg-zinc-800/60"
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                                                                {c.name}
                                                                {c.type === "INDIVIDUAL" && (
                                                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">B2C</span>
                                                                )}
                                                            </div>
                                                            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                                                                {c.phone || "No phone"} {c.gstin ? `• GST: ${c.gstin}` : ""}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-zinc-500 uppercase">Outstanding</div>
                                                            <div className="font-mono text-xs font-medium text-amber-400 tabular-nums">
                                                                {formatINR(Number(c.outstandingAmount || 0))}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="p-2 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-xs">
                                        <span className="text-[10px] text-zinc-500">
                                            Use <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">↓</kbd> + <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">Enter</kbd>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddCustomer(true)}
                                            className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                                        >
                                            <Plus size={13} /> Add Customer
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3">
                                <div>
                                    <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                                        {selectedCustomer?.name}
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                            Active Account
                                        </span>
                                    </div>
                                    <div className="text-xs text-zinc-400 font-mono mt-0.5">
                                        {selectedCustomer?.phone || "No phone"} {selectedCustomer?.gstin ? `| GSTIN: ${selectedCustomer?.gstin}` : ""}
                                    </div>
                                </div>
                                <div className="text-xs text-zinc-500">
                                    Billing Mode: <strong className="text-zinc-200">{orderType}</strong>
                                </div>
                            </div>

                            {/* Credit & Exposure Gauges */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                                <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-zinc-800/70">
                                    <span className="text-zinc-500 block text-[10px] uppercase font-mono">Credit Limit</span>
                                    <span className="font-mono font-semibold text-zinc-200 tabular-nums text-sm">
                                        {creditLimit > 0 ? formatINR(creditLimit) : "Unlimited"}
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-zinc-800/70">
                                    <span className="text-zinc-500 block text-[10px] uppercase font-mono">Current Dues</span>
                                    <span className="font-mono font-semibold text-amber-400 tabular-nums text-sm">
                                        {formatINR(currentOutstanding)}
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-zinc-800/70">
                                    <span className="text-zinc-500 block text-[10px] uppercase font-mono">Available Credit</span>
                                    <span
                                        className={`font-mono font-semibold tabular-nums text-sm ${
                                            availableCredit <= 0 && creditLimit > 0 ? "text-rose-400" : "text-emerald-400"
                                        }`}
                                    >
                                        {creditLimit > 0 ? formatINR(availableCredit) : "Unlimited"}
                                    </span>
                                </div>
                            </div>

                            {/* Credit Limit Exceeded Safeguard Banner */}
                            {isCreditExceeded && (
                                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2 text-xs">
                                    <div className="flex items-center gap-2 font-bold text-rose-400">
                                        <AlertCircle size={15} />
                                        <span>
                                            Credit Limit Exceeded by {formatINR(currentOutstanding + grandTotal - creditLimit)}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-rose-200/90 leading-relaxed">
                                        Customer credit limit is {formatINR(creditLimit)}. Total post-order balance will be {formatINR(currentOutstanding + grandTotal)}.
                                    </p>
                                    <label className="flex items-center gap-2 cursor-pointer pt-1 font-semibold text-zinc-100">
                                        <input
                                            type="checkbox"
                                            checked={overrideCreditLimit}
                                            onChange={e => setOverrideCreditLimit(e.target.checked)}
                                            className="rounded border-zinc-700 bg-zinc-950 text-blue-600 focus:ring-0"
                                        />
                                        <span>Authorize Order via Manager/Owner Override</span>
                                    </label>
                                    {overrideCreditLimit && (
                                        <input
                                            type="text"
                                            placeholder="Reason for override (e.g., Post-dated cheque in hand / Owner verbal approval)..."
                                            value={overrideReason}
                                            onChange={e => setOverrideReason(e.target.value)}
                                            className="w-full px-3 py-1.5 text-xs rounded bg-zinc-950 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-rose-400"
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Keyboard-First Rapid Line Items Grid */}
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 sm:p-5 backdrop-blur-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800/60">
                        <div>
                            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                                Order Line Items ({validItemsCount} added)
                            </h3>
                            <span className="text-[11px] text-zinc-500">
                                Press <kbd className="px-1 rounded bg-zinc-800 font-mono text-zinc-400">Enter</kbd> through cells to add rows automatically.
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleAddNewRow(true)}
                                className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:bg-blue-600/25 transition font-medium"
                            >
                                <Plus size={13} /> Add Row (Enter)
                            </button>
                        </div>
                    </div>

                    {/* Desktop Tabular Grid */}
                    <div className="overflow-visible">
                        <div className="min-w-full">
                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-2 pb-2 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold px-1">
                                <div className="col-span-5">Product / Item (Search or Select)</div>
                                <div className="col-span-1 text-center">Unit</div>
                                <div className="col-span-1 text-center">Qty</div>
                                <div className="col-span-2 text-right">Rate (₹)</div>
                                <div className="col-span-1 text-right">Disc (₹)</div>
                                <div className="col-span-1 text-right">GST %</div>
                                <div className="col-span-1 text-right">Total (₹)</div>
                            </div>

                            {/* Table Rows */}
                            <div className="space-y-2 mt-2">
                                {items.map((row, idx) => {
                                    const filteredOptions = getRowFilteredOptions(row.searchQuery ?? "");
                                    const lineNet =
                                        orderType === "B2C"
                                            ? row.price * row.quantity - row.discount
                                            : (row.price * row.quantity - row.discount) * (1 + row.taxRate / 100);

                                    return (
                                        <div
                                            key={row.rowId}
                                            className={`grid grid-cols-12 gap-2 items-center p-1.5 rounded-lg border transition ${
                                                row.productId
                                                    ? "bg-zinc-950/40 border-zinc-800/80"
                                                    : "bg-zinc-950/80 border-blue-500/30 ring-1 ring-blue-500/10"
                                            }`}
                                        >
                                            {/* Product Combobox Column (Col 5) */}
                                            <div className="col-span-5 relative">
                                                {!row.productId ? (
                                                    <div className="relative">
                                                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                                                        <input
                                                            ref={el => { productInputRefs.current[row.rowId] = el; }}
                                                            value={row.searchQuery ?? ""}
                                                            onChange={e => {
                                                                updateRow(row.rowId, {
                                                                    searchQuery: e.target.value,
                                                                    isDropdownOpen: true,
                                                                });
                                                                setActiveRowHighlight(0);
                                                            }}
                                                            onFocus={() => {
                                                                updateRow(row.rowId, { isDropdownOpen: true });
                                                                setActiveRowHighlight(0);
                                                            }}
                                                            onKeyDown={e => {
                                                                if (e.key === "ArrowDown") {
                                                                    e.preventDefault();
                                                                    setActiveRowHighlight(i => Math.min(i + 1, filteredOptions.length - 1));
                                                                } else if (e.key === "ArrowUp") {
                                                                    e.preventDefault();
                                                                    setActiveRowHighlight(i => Math.max(i - 1, 0));
                                                                } else if (e.key === "Enter") {
                                                                    e.preventDefault();
                                                                    if (filteredOptions[activeRowHighlight]) {
                                                                        handleSelectProduct(row.rowId, filteredOptions[activeRowHighlight]);
                                                                    }
                                                                } else if (e.key === "Escape") {
                                                                    updateRow(row.rowId, { isDropdownOpen: false });
                                                                }
                                                            }}
                                                            placeholder="Type product name or SKU..."
                                                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded bg-zinc-900 border border-zinc-700/80 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                                                        />

                                                        {row.isDropdownOpen && (
                                                            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-zinc-800/40">
                                                                {filteredOptions.length === 0 ? (
                                                                    <div className="p-3 text-center text-xs text-zinc-500">
                                                                        No product found matching &quot;{row.searchQuery}&quot;
                                                                    </div>
                                                                ) : (
                                                                    filteredOptions.map((opt, optIdx) => (
                                                                        <button
                                                                            key={`${opt.productId}_${opt.variantId || "base"}`}
                                                                            type="button"
                                                                            onClick={() => handleSelectProduct(row.rowId, opt)}
                                                                            onMouseEnter={() => setActiveRowHighlight(optIdx)}
                                                                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition ${
                                                                                optIdx === activeRowHighlight
                                                                                    ? "bg-blue-600/20 text-blue-200"
                                                                                    : "text-zinc-300 hover:bg-zinc-800/60"
                                                                            }`}
                                                                        >
                                                                            <div>
                                                                                <div className="font-medium text-zinc-100">{opt.displayName}</div>
                                                                                <div className="text-[10px] text-zinc-500 font-mono">
                                                                                    SKU: {opt.sku} | Tax: {opt.taxRate}%
                                                                                </div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <div className="font-mono text-zinc-200 font-semibold tabular-nums">
                                                                                    {formatINR(opt.price)}
                                                                                </div>
                                                                                <div
                                                                                    className={`text-[9px] font-mono ${
                                                                                        opt.stock > 0 ? "text-emerald-400" : "text-rose-400"
                                                                                    }`}
                                                                                >
                                                                                    {opt.stock} in stock
                                                                                </div>
                                                                            </div>
                                                                        </button>
                                                                    ))
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between bg-zinc-900/90 border border-zinc-800 rounded px-2.5 py-1.5">
                                                        <div className="truncate pr-2">
                                                            <span className="text-xs font-medium text-zinc-100 truncate block">
                                                                {row.productName}
                                                            </span>
                                                            <span className="text-[10px] text-zinc-500 font-mono">
                                                                Stock: {row.stock} {row.unit}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                updateRow(row.rowId, {
                                                                    productId: "",
                                                                    productName: "",
                                                                    searchQuery: "",
                                                                    isDropdownOpen: true,
                                                                });
                                                                setTimeout(() => productInputRefs.current[row.rowId]?.focus(), 20);
                                                            }}
                                                            className="text-[10px] text-zinc-500 hover:text-blue-400 uppercase font-mono px-1 rounded transition"
                                                        >
                                                            Change
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Unit Column (Col 1) */}
                                            <div className="col-span-1 text-center text-xs font-mono text-zinc-400">
                                                {row.unit || "Pcs"}
                                            </div>

                                            {/* Qty Column (Col 1) */}
                                            <div className="col-span-1">
                                                <input
                                                    ref={el => { qtyInputRefs.current[row.rowId] = el; }}
                                                    type="number"
                                                    min={1}
                                                    value={row.quantity}
                                                    onChange={e => updateRow(row.rowId, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                                    onKeyDown={e => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            const rateInput = rateInputRefs.current[row.rowId];
                                                            if (rateInput) {
                                                                rateInput.focus();
                                                                rateInput.select();
                                                            }
                                                        }
                                                    }}
                                                    className="w-full text-center py-1 text-xs font-mono font-medium rounded bg-zinc-900 border border-zinc-700/80 text-zinc-100 focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>

                                            {/* Rate Column (Col 2) */}
                                            <div className="col-span-2">
                                                <input
                                                    ref={el => { rateInputRefs.current[row.rowId] = el; }}
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
                                                    value={row.price}
                                                    onChange={e => updateRow(row.rowId, { price: parseFloat(e.target.value) || 0 })}
                                                    onKeyDown={e => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            const discountInput = discountInputRefs.current[row.rowId];
                                                            if (discountInput) {
                                                                discountInput.focus();
                                                                discountInput.select();
                                                            }
                                                        }
                                                    }}
                                                    className="w-full text-right pr-2 py-1 text-xs font-mono font-medium rounded bg-zinc-900 border border-zinc-700/80 text-zinc-100 focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>

                                            {/* Discount Column (Col 1) */}
                                            <div className="col-span-1">
                                                <input
                                                    ref={el => { discountInputRefs.current[row.rowId] = el; }}
                                                    type="number"
                                                    min={0}
                                                    step="1"
                                                    value={row.discount}
                                                    onChange={e => updateRow(row.rowId, { discount: parseFloat(e.target.value) || 0 })}
                                                    onKeyDown={e => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            const isLast = idx === items.length - 1;
                                                            if (isLast) {
                                                                handleAddNewRow(true);
                                                            } else {
                                                                const nextRowId = items[idx + 1].rowId;
                                                                productInputRefs.current[nextRowId]?.focus();
                                                            }
                                                        }
                                                    }}
                                                    className="w-full text-right pr-2 py-1 text-xs font-mono font-medium rounded bg-zinc-900 border border-zinc-700/80 text-zinc-100 focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>

                                            {/* Tax Rate (Col 1) */}
                                            <div className="col-span-1 text-right text-xs font-mono text-zinc-400 tabular-nums">
                                                {row.taxRate}%
                                            </div>

                                            {/* Line Total & Remove Action (Col 1) */}
                                            <div className="col-span-1 flex items-center justify-end gap-1.5">
                                                <span className="font-mono text-xs font-semibold text-zinc-100 tabular-nums">
                                                    {formatINR(Math.max(0, lineNet))}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRow(row.rowId)}
                                                    tabIndex={-1}
                                                    className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Summary Math Card */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 border-t border-zinc-800 gap-4">
                        <div className="text-xs text-zinc-500 space-y-1">
                            <p>
                                💡 Tip: Press <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-300">Enter</kbd> on the Discount column to immediately insert a new row.
                            </p>
                            <p>
                                Press <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-300">Ctrl + Enter</kbd> anywhere to finalize and create the order.
                            </p>
                        </div>

                        <div className="w-full sm:w-72 bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex justify-between text-zinc-400">
                                <span>Taxable Subtotal:</span>
                                <span className="font-mono tabular-nums text-zinc-200">{formatINR(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-zinc-400">
                                <span>Estimated GST:</span>
                                <span className="font-mono tabular-nums text-zinc-300">{formatINR(taxTotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-zinc-100 pt-2 border-t border-zinc-800">
                                <span>Grand Total:</span>
                                <span className="font-mono tabular-nums text-blue-400 text-base">{formatINR(grandTotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Logistics & Operational Details */}
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 sm:p-5 backdrop-blur-sm space-y-4">
                    <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                        Logistics & Dispatch Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label>
                            <span className="text-xs text-zinc-400 mb-1 block">Dispatch Warehouse</span>
                            <select
                                value={warehouseId}
                                onChange={e => setWarehouseId(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-100 focus:border-blue-500 focus:outline-none transition appearance-none font-sans"
                            >
                                <option value="">Auto-select Primary Warehouse</option>
                                {warehouses.map((w: any) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span className="text-xs text-zinc-400 mb-1 block">Expected Delivery Date</span>
                            <input
                                type="date"
                                value={deliveryDate}
                                onChange={e => setDeliveryDate(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-100 focus:border-blue-500 focus:outline-none transition font-sans"
                            />
                        </label>
                        <label className="sm:col-span-2">
                            <span className="text-xs text-zinc-400 mb-1 block">Delivery Notes / Transport Instructions</span>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={2}
                                placeholder="e.g. Deliver before 2 PM, hand over to godown manager Ramesh..."
                                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none transition resize-none font-sans"
                            />
                        </label>
                    </div>
                </div>

                {/* Internal Commission Accordion */}
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden backdrop-blur-sm">
                    <button
                        type="button"
                        onClick={() => setShowCommission(!showCommission)}
                        className="w-full flex items-center justify-between p-4 text-xs font-semibold text-zinc-300 hover:bg-zinc-800/40 transition"
                    >
                        <span>
                            💼 Internal Commission & Incentive{" "}
                            <span className="font-normal text-zinc-500">(Not visible on customer invoice)</span>
                        </span>
                        <ChevronDown size={15} className={`text-zinc-500 transition-transform ${showCommission ? "rotate-180" : ""}`} />
                    </button>
                    {showCommission && (
                        <div className="px-5 pb-5 pt-1 border-t border-zinc-800/80 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label>
                                    <span className="text-xs text-zinc-400 mb-1 block">Recipient</span>
                                    <select
                                        value={commissionTo}
                                        onChange={e => setCommissionTo(e.target.value)}
                                        className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:border-blue-500 focus:outline-none transition appearance-none"
                                    >
                                        <option value="">Select recipient...</option>
                                        <option value="Salesman">Salesman / DSR</option>
                                        <option value="Mistri">Mistri / Mason</option>
                                        <option value="Contractor">Contractor / Architect</option>
                                        <option value="Dealer">Sub-Dealer / Agent</option>
                                        <option value="Other">Other (custom)</option>
                                    </select>
                                </label>
                                {commissionTo && (
                                    <label>
                                        <span className="text-xs text-zinc-400 mb-1 block">
                                            {commissionTo === "Other" ? "Custom Role / Name *" : "Person Name (Optional)"}
                                        </span>
                                        <input
                                            type="text"
                                            value={commissionToCustom}
                                            onChange={e => setCommissionToCustom(e.target.value)}
                                            placeholder={commissionTo === "Other" ? "e.g. Plumber, Electrician" : "e.g. Ramesh Singh"}
                                            className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:border-blue-500 focus:outline-none transition"
                                        />
                                    </label>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label>
                                    <span className="text-xs text-zinc-400 mb-1 block">Type</span>
                                    <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-0.5">
                                        <button
                                            type="button"
                                            onClick={() => setCommissionType("FIXED")}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded transition ${
                                                commissionType === "FIXED"
                                                    ? "bg-blue-600 text-white"
                                                    : "text-zinc-500 hover:text-zinc-300"
                                            }`}
                                        >
                                            Fixed Amount (₹)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCommissionType("PERCENTAGE")}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded transition ${
                                                commissionType === "PERCENTAGE"
                                                    ? "bg-blue-600 text-white"
                                                    : "text-zinc-500 hover:text-zinc-300"
                                            }`}
                                        >
                                            Percentage (%)
                                        </button>
                                    </div>
                                </label>
                                <label>
                                    <span className="text-xs text-zinc-400 mb-1 block">
                                        {commissionType === "FIXED" ? "Amount (₹)" : "Percentage (%)"}
                                    </span>
                                    <input
                                        type="number"
                                        min={0}
                                        step={commissionType === "FIXED" ? 1 : 0.5}
                                        max={commissionType === "PERCENTAGE" ? 100 : undefined}
                                        value={commissionValue || ""}
                                        onChange={e => setCommissionValue(parseFloat(e.target.value) || 0)}
                                        placeholder={commissionType === "FIXED" ? "e.g. 500" : "e.g. 2.5"}
                                        className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:border-blue-500 focus:outline-none transition font-mono"
                                    />
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* Desktop Submission Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                    <Link
                        href="/orders"
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition"
                    >
                        ← Cancel & Return to Orders
                    </Link>

                    <div className="flex items-center gap-3">
                        <button
                            ref={submitButtonRef}
                            type="submit"
                            disabled={
                                !customerId ||
                                validItemsCount === 0 ||
                                createOrder.isPending ||
                                (isCreditExceeded && !overrideCreditLimit)
                            }
                            className="px-6 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-blue-600/30 flex items-center gap-2"
                        >
                            <CornerDownLeft size={14} />
                            {createOrder.isPending
                                ? "Creating Order..."
                                : isCreditExceeded && !overrideCreditLimit
                                ? "Credit Limit Exceeded"
                                : "Create Order (Ctrl+Enter)"}
                        </button>
                    </div>
                </div>

                {/* Mobile Floating Sticky Footer */}
                <div className="sm:hidden fixed bottom-14 left-0 right-0 z-30 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 p-3 px-4 flex items-center justify-between shadow-2xl">
                    <div>
                        <span className="text-[10px] text-zinc-500 block uppercase font-mono">Grand Total</span>
                        <span className="font-mono font-bold text-sm text-blue-400 tabular-nums">
                            {formatINR(grandTotal)}
                        </span>
                    </div>
                    <button
                        type="submit"
                        disabled={
                            !customerId ||
                            validItemsCount === 0 ||
                            createOrder.isPending ||
                            (isCreditExceeded && !overrideCreditLimit)
                        }
                        className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition shadow-md"
                    >
                        {createOrder.isPending ? "Creating..." : "Save Order →"}
                    </button>
                </div>
            </form>

            <AddCustomerModal open={showAddCustomer} onClose={() => setShowAddCustomer(false)} />
        </div>
    );
}
