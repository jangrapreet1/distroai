"use client";

import { useState, useMemo, useEffect } from "react";
import { X, Plus, Trash2, Calendar, Receipt, CreditCard, RefreshCw, SlidersHorizontal, Warehouse } from "lucide-react";
import toast from "react-hot-toast";
import { formatINR } from "@/lib/utils";
import { useCreateCustomerTransaction, useProducts, useWarehouses } from "@/hooks/api-hooks";
import type { CustomerTransactionType, PaymentMethod, CreateTransactionItemDto, CreateTransactionDto } from "@/types/customer-transactions";

interface CreateTransactionModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  customerId: string;
  customerName?: string;
  currentBalance?: number;
  initialType?: CustomerTransactionType;
  defaultType?: CustomerTransactionType;
  onSubmit?: (data: CreateTransactionDto) => void;
  isPending?: boolean;
}

export interface FormItem {
  id: string;
  productId?: string;
  variantId?: string;
  productName: string;
  quantity: number | "";
  unitPrice: number | "";
  unit: string;
}

export interface CatalogOption {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  displayName: string;
  unit: string;
  sellingPrice: number;
}

export function LineItemsTable({
  items,
  catalogOptions,
  onProductSelect,
  onItemChange,
  onRemoveItem,
  amountColor = "var(--green-bright)",
}: {
  items: FormItem[];
  catalogOptions: CatalogOption[];
  onProductSelect: (index: number, key: string) => void;
  onItemChange: (index: number, field: keyof FormItem, value: string | number) => void;
  onRemoveItem: (index: number) => void;
  amountColor?: string;
}) {
  return (
    <div className="overflow-x-auto border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg-secondary)]/40 shadow-inner">
      <table className="w-full text-left border-collapse table-fixed min-w-[620px]">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)] text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
            <th className="py-2.5 px-3 w-[40%]">Item Name / Description (Hindi/Eng)</th>
            <th className="py-2.5 px-2 w-[14%] text-center">Quantity</th>
            <th className="py-2.5 px-2 w-[12%] text-center">Unit</th>
            <th className="py-2.5 px-2 w-[16%] text-right">Rate (₹)</th>
            <th className="py-2.5 px-3 w-[18%] text-right">Amount (₹)</th>
            <th className="py-2.5 px-1 w-9 text-center"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {items.map((item, idx) => {
            const itemAmount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
            const selectedKey = item.variantId
              ? `${item.productId}:${item.variantId}`
              : item.productId
              ? catalogOptions.find(
                  (c) =>
                    c.productId === item.productId &&
                    (c.name === item.productName || c.displayName === item.productName)
                )?.key || item.productId
              : item.productName
              ? "__CUSTOM__"
              : "";

            return (
              <tr key={item.id} className="hover:bg-white/[0.02] transition">
                <td className="py-2 px-3 align-top space-y-1.5">
                  <select
                    value={selectedKey}
                    onChange={(e) => onProductSelect(idx, e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition cursor-pointer truncate"
                  >
                    <option value="">-- Choose from Inventory ({catalogOptions.length}) --</option>
                    {catalogOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.displayName} — ₹{opt.sellingPrice} / {opt.unit}
                      </option>
                    ))}
                    <option value="__CUSTOM__">✍️ Custom Item / Manual Entry</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Item Name (e.g. अलमारी के लिए पत्थर)"
                    value={item.productName}
                    onChange={(e) => onItemChange(idx, "productName", e.target.value)}
                    className="w-full px-2.5 py-1 text-xs rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition"
                  />
                </td>

                <td className="py-2 px-2 align-top">
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="Qty"
                    value={item.quantity === "" ? "" : item.quantity}
                    onChange={(e) =>
                      onItemChange(idx, "quantity", e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                    className="w-full text-center px-2 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                  />
                </td>

                <td className="py-2 px-2 align-top">
                  <input
                    type="text"
                    placeholder="Unit"
                    value={item.unit}
                    onChange={(e) => onItemChange(idx, "unit", e.target.value)}
                    className="w-full text-center px-2 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                  />
                </td>

                <td className="py-2 px-2 align-top">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Rate"
                    value={item.unitPrice === "" ? "" : item.unitPrice}
                    onChange={(e) =>
                      onItemChange(idx, "unitPrice", e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                    className="w-full text-right px-2.5 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition font-mono"
                  />
                </td>

                <td
                  className="py-2 px-3 align-top text-right font-mono text-sm font-semibold pt-3.5"
                  style={{ color: amountColor }}
                >
                  {formatINR(itemAmount)}
                </td>

                <td className="py-2 px-1 align-top text-center pt-2.5">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(idx)}
                    className="w-8 h-8 inline-flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 transition"
                    aria-label="Remove item"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CreateTransactionModalContent({
  onClose,
  customerId,
  customerName = "Customer",
  currentBalance = 0,
  initialType,
  defaultType,
  onSubmit,
  isPending: externalIsPending,
}: CreateTransactionModalProps) {
  const startingType: CustomerTransactionType = defaultType || initialType || "SALE";

  const createTx = useCreateCustomerTransaction(customerId);
  const isSubmitting = externalIsPending ?? createTx.isPending;

  const { data: prodData } = useProducts({ limit: 100, isActive: true, isDraft: false });
  const { data: warehouseData } = useWarehouses();

  const warehouses = useMemo(() => {
    const w = warehouseData as any;
    if (Array.isArray(w?.data)) return w.data;
    if (Array.isArray(w)) return w;
    return [];
  }, [warehouseData]);

  const [warehouseId, setWarehouseId] = useState<string>("");

  useEffect(() => {
    if (warehouses.length > 0 && !warehouseId) {
      const def = warehouses.find((w: any) => w.isDefault) || warehouses[0];
      if (def) setWarehouseId(def.id);
    }
  }, [warehouses, warehouseId]);

  const rawProducts = useMemo(() => {
    const p = prodData as any;
    if (Array.isArray(p?.data?.data)) return p.data.data;
    if (Array.isArray(p?.data)) return p.data;
    if (Array.isArray(p)) return p;
    return [];
  }, [prodData]);

  const catalogOptions = useMemo<CatalogOption[]>(() => {
    const list: CatalogOption[] = [];
    for (const prod of rawProducts) {
      if (prod.hasVariants && Array.isArray(prod.variants) && prod.variants.length > 0) {
        for (const v of prod.variants) {
          list.push({
            key: `${prod.id}:${v.id}`,
            productId: prod.id,
            variantId: v.id,
            name: `${prod.name} (${v.name})`,
            displayName: `${prod.name} — ${v.name}`,
            unit: prod.unit || "PCS",
            sellingPrice: typeof v.sellingPrice === "number" ? v.sellingPrice : (prod.sellingPrice || 0),
          });
        }
      } else {
        list.push({
          key: prod.id,
          productId: prod.id,
          name: prod.name,
          displayName: prod.name,
          unit: prod.unit || "PCS",
          sellingPrice: prod.sellingPrice || 0,
        });
      }
    }
    return list;
  }, [rawProducts]);

  const [type, setType] = useState<CustomerTransactionType>(startingType);

  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Payment specific
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentAmount, setPaymentAmount] = useState<string>("");

  // Return specific
  const [returnMode, setReturnMode] = useState<"ITEMS" | "LUMP_SUM">("ITEMS");
  const [lumpSumReturnAmount, setLumpSumReturnAmount] = useState<string>("");

  // Adjustment specific
  const [adjustmentDirection, setAdjustmentDirection] = useState<"DEBIT" | "CREDIT">("CREDIT");
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>("");

  // Line items for SALE / RETURN
  const [items, setItems] = useState<FormItem[]>([
    { id: "1", productName: "", quantity: 1, unitPrice: 0, unit: "PCS" },
  ]);

  // Calculate items sum
  const itemsTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const q = typeof item.quantity === "number" ? item.quantity : 0;
      const p = typeof item.unitPrice === "number" ? item.unitPrice : 0;
      return sum + q * p;
    }, 0);
  }, [items]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), productName: "", quantity: 1, unitPrice: 0, unit: "PCS" },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof FormItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return { ...item, [field]: value };
      })
    );
  };

  const handleProductSelect = (index: number, optionKey: string) => {
    if (!optionKey) {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, productId: undefined, variantId: undefined, productName: "" } : item
        )
      );
      return;
    }

    if (optionKey === "__CUSTOM__") {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, productId: undefined, variantId: undefined } : item
        )
      );
      return;
    }

    const opt = catalogOptions.find((o) => o.key === optionKey);
    if (!opt) return;

    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          productId: opt.productId,
          variantId: opt.variantId,
          productName: opt.name,
          unit: opt.unit || "PCS",
          unitPrice: opt.sellingPrice || 0,
        };
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalAmount = 0;
    let payloadItems: CreateTransactionItemDto[] | undefined = undefined;

    if (type === "SALE") {
      const validItems = items.filter((it) => it.productName.trim() !== "");
      if (validItems.length > 0) {
        payloadItems = validItems.map((it) => {
          const q = Number(it.quantity) || 0;
          const u = Number(it.unitPrice) || 0;
          return {
            productId: it.productId,
            variantId: it.variantId,
            productName: it.productName.trim(),
            quantity: q,
            unitPrice: u,
            amount: Math.round(q * u * 100) / 100,
            unit: it.unit || "PCS",
          };
        });
        finalAmount = payloadItems.reduce((acc, it) => acc + (it.amount ?? 0), 0);
      } else {
        finalAmount = 0;
      }

      if (finalAmount <= 0) {
        toast.error("Please enter at least one line item or a valid sale amount");
        return;
      }
    } else if (type === "RETURN") {
      if (returnMode === "ITEMS") {
        const validItems = items.filter((it) => it.productName.trim() !== "");
        if (validItems.length > 0) {
          payloadItems = validItems.map((it) => {
            const q = Number(it.quantity) || 0;
            const u = Number(it.unitPrice) || 0;
            return {
              productId: it.productId,
              variantId: it.variantId,
              productName: it.productName.trim(),
              quantity: q,
              unitPrice: u,
              amount: Math.round(q * u * 100) / 100,
              unit: it.unit || "PCS",
            };
          });
          finalAmount = payloadItems.reduce((acc, it) => acc + (it.amount ?? 0), 0);
        } else {
          finalAmount = Number(lumpSumReturnAmount) || 0;
        }
      } else {
        finalAmount = Number(lumpSumReturnAmount) || 0;
      }

      if (finalAmount <= 0) {
        toast.error("Please enter a valid return amount");
        return;
      }
    } else if (type === "PAYMENT") {
      finalAmount = Number(paymentAmount) || 0;
      if (finalAmount <= 0) {
        toast.error("Please enter a valid payment amount");
        return;
      }
    } else if (type === "ADJUSTMENT") {
      const rawAdj = Math.abs(Number(adjustmentAmount));
      if (rawAdj === 0 || isNaN(rawAdj)) {
        toast.error("Please enter a valid non-zero adjustment amount");
        return;
      }
      finalAmount = adjustmentDirection === "CREDIT" ? -rawAdj : rawAdj;
    }

    const payload: CreateTransactionDto = {
      date,
      type,
      amount: Math.round(finalAmount * 100) / 100,
      description: description.trim() || undefined,
      paymentMethod: type === "PAYMENT" ? paymentMethod : undefined,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      items: payloadItems,
      warehouseId: (type === "SALE" || type === "RETURN") ? (warehouseId || undefined) : undefined,
    };

    if (onSubmit) {
      onSubmit(payload);
      return;
    }

    createTx.mutate(payload, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  const getHeadingTitle = () => {
    switch (type) {
      case "SALE":
        return "Goods Given (Sale)";
      case "RETURN":
        return "Goods Returned";
      case "PAYMENT":
        return "Payment Received";
      case "ADJUSTMENT":
        return "Adjustment";
      default:
        return "Record Transaction";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-[var(--bg-primary)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-white/[0.01]">
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>
              {getHeadingTitle()}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Customer: <span className="text-[var(--gold)] font-medium">{customerName}</span>
              {currentBalance !== undefined && (
                <>
                  {" "}| Current Balance:{" "}
                  <span className="font-mono text-[var(--text-secondary)]">{formatINR(currentBalance)}</span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* 4-Type Segmented Tab Bar */}
        <div className="grid grid-cols-4 p-2 bg-[var(--bg-secondary)] border-b border-[var(--border)] gap-1">
          <button
            type="button"
            onClick={() => setType("SALE")}
            className={`py-2 px-3 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition ${
              type === "SALE"
                ? "bg-[var(--green-bright)]/15 text-[var(--green-bright)] border border-[var(--green-bright)]/30 shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <Receipt size={14} /> Goods Given (Sale)
          </button>

          <button
            type="button"
            onClick={() => setType("RETURN")}
            className={`py-2 px-3 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition ${
              type === "RETURN"
                ? "bg-[var(--orange)]/15 text-[var(--orange)] border border-[var(--orange)]/30 shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <RefreshCw size={14} /> Goods Returned
          </button>

          <button
            type="button"
            onClick={() => setType("PAYMENT")}
            className={`py-2 px-3 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition ${
              type === "PAYMENT"
                ? "bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30 shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <CreditCard size={14} /> Payment Received
          </button>

          <button
            type="button"
            onClick={() => setType("ADJUSTMENT")}
            className={`py-2 px-3 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition ${
              type === "ADJUSTMENT"
                ? "bg-[var(--purple)]/20 text-[#A78BFA] border border-[var(--purple)]/40 shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <SlidersHorizontal size={14} /> Adjustment
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Date & Reference Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label>
              <span className="text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1.5">
                <Calendar size={13} className="text-[var(--gold)]" /> Transaction Date *
              </span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
              />
            </label>

            <label>
              <span className="text-xs text-[var(--text-muted)] mb-1 block">
                {type === "PAYMENT"
                  ? "Reference / UTR / Cheque No."
                  : type === "RETURN"
                  ? "Challan / Credit Note No."
                  : "Bill / Invoice Reference"}
              </span>
              <input
                type="text"
                placeholder={
                  type === "PAYMENT"
                    ? "e.g. UPI/423456789012 or Reference"
                    : "e.g. बिल सं. १०४२"
                }
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
              />
            </label>
          </div>

          {/* ============================================================ */}
          {/* TYPE A: SALE (GOODS GIVEN)                                   */}
          {/* ============================================================ */}
          {type === "SALE" && (
            <div className="space-y-4">
              {/* Quick Sale Auto-Sync & Warehouse Selector Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-[var(--gold)]/10 border border-[var(--gold)]/25">
                <div>
                  <div className="text-xs font-semibold text-[var(--gold)] flex items-center gap-1.5">
                    <span>⚡ Quick Sale</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--gold)]/20 uppercase tracking-wide font-bold">
                      Auto-Deducts Stock & Issues Invoice
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Deducts warehouse inventory, records delivered order & official invoice, and posts to ledger.
                  </p>
                </div>

                {warehouses.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap flex items-center gap-1 font-medium">
                      <Warehouse size={13} className="text-[var(--gold)]" /> Warehouse:
                    </span>
                    <select
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none cursor-pointer"
                    >
                      {warehouses.map((w: any) => (
                        <option key={w.id} value={w.id}>
                          {w.name} {w.isDefault ? "(Default)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Line Items (सामान का विवरण)
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1 text-xs text-[var(--gold)] hover:text-[var(--gold-light)] font-medium"
                >
                  <Plus size={14} /> Add Row
                </button>
              </div>

              <LineItemsTable
                items={items}
                catalogOptions={catalogOptions}
                onProductSelect={handleProductSelect}
                onItemChange={handleItemChange}
                onRemoveItem={handleRemoveItem}
                amountColor="var(--green-bright)"
              />

              {/* Total Summary Bar */}
              <div className="flex justify-between items-center p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
                <span className="text-xs text-[var(--text-muted)]">Calculated Total Goods Given:</span>
                <span className="text-base font-bold font-mono text-[var(--green-bright)]">
                  {formatINR(itemsTotal)}
                </span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TYPE B: RETURN (GOODS RETURNED)                              */}
          {/* ============================================================ */}
          {type === "RETURN" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReturnMode("ITEMS")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                    returnMode === "ITEMS"
                      ? "bg-[var(--orange)]/15 text-[var(--orange)] border-[var(--orange)]/30"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  Itemized Return (आइटम अनुसार)
                </button>
                <button
                  type="button"
                  onClick={() => setReturnMode("LUMP_SUM")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                    returnMode === "LUMP_SUM"
                      ? "bg-[var(--orange)]/15 text-[var(--orange)] border-[var(--orange)]/30"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  Lump Sum Amount (एकमुश्त राशि)
                </button>
              </div>

              {returnMode === "LUMP_SUM" ? (
                <label className="block">
                  <span className="text-xs text-[var(--text-muted)] mb-1 block">Return Amount (₹) *</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="e.g. 5000"
                    value={lumpSumReturnAmount}
                    onChange={(e) => setLumpSumReturnAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition font-mono"
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <LineItemsTable
                    items={items}
                    catalogOptions={catalogOptions}
                    onProductSelect={handleProductSelect}
                    onItemChange={handleItemChange}
                    onRemoveItem={handleRemoveItem}
                    amountColor="var(--orange)"
                  />
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 text-xs text-[var(--gold)] hover:text-[var(--gold-light)] font-medium"
                  >
                    <Plus size={14} /> Add Returned Item
                  </button>

                  <div className="flex justify-between items-center p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
                    <span className="text-xs text-[var(--text-muted)]">Calculated Total Goods Returned:</span>
                    <span className="text-base font-bold font-mono text-[var(--orange)]">
                      {formatINR(itemsTotal)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TYPE C: PAYMENT (PAYMENT RECEIVED)                           */}
          {/* ============================================================ */}
          {type === "PAYMENT" && (
            <div className="space-y-4">
              <div>
                <span className="text-xs text-[var(--text-muted)] mb-2 block">Payment Mode *</span>
                <div className="grid grid-cols-4 gap-2">
                  {(["CASH", "UPI", "CHEQUE", "BANK_TRANSFER"] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 text-xs font-bold rounded-md border transition uppercase tracking-wider ${
                        paymentMethod === m
                          ? "bg-[var(--gold)] text-black border-[var(--gold)] shadow-md"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5"
                      }`}
                    >
                      {m.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-xs text-[var(--text-muted)] mb-1 block">Payment Amount Received (₹) *</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="Amount (₹)"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-4 py-2.5 text-base font-bold font-mono rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--green-bright)] focus:border-[var(--gold)] focus:outline-none transition"
                />
              </label>

              {/* Quick Preset Buttons */}
              {currentBalance > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="text-[10px] text-[var(--text-muted)] self-center mr-1">Quick fill:</span>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(String(currentBalance))}
                    className="px-2.5 py-1 text-xs rounded border border-[var(--border)] text-[var(--gold)] hover:bg-[var(--gold)]/10"
                  >
                    Full Balance ({formatINR(currentBalance)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(String(Math.round(currentBalance / 2)))}
                    className="px-2.5 py-1 text-xs rounded border border-[var(--border)] text-[var(--text-secondary)] hover:bg-white/5"
                  >
                    50% ({formatINR(Math.round(currentBalance / 2))})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TYPE D: ADJUSTMENT                                           */}
          {/* ============================================================ */}
          {type === "ADJUSTMENT" && (
            <div className="space-y-4">
              <div>
                <span className="text-xs text-[var(--text-muted)] mb-2 block">Adjustment Direction *</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjustmentDirection("CREDIT")}
                    className={`p-3 text-xs font-bold rounded-lg border text-left transition ${
                      adjustmentDirection === "CREDIT"
                        ? "bg-[var(--green-bright)]/10 border-[var(--green-bright)]/50 text-[var(--green-bright)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:bg-white/5"
                    }`}
                  >
                    <div className="font-semibold text-sm mb-0.5">Credit / Discount (-)</div>
                    <div className="text-[11px] opacity-80">Reduces customer outstanding balance</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustmentDirection("DEBIT")}
                    className={`p-3 text-xs font-bold rounded-lg border text-left transition ${
                      adjustmentDirection === "DEBIT"
                        ? "bg-[var(--red)]/10 border-[var(--red)]/50 text-[var(--red)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:bg-white/5"
                    }`}
                  >
                    <div className="font-semibold text-sm mb-0.5">Debit / Charge (+)</div>
                    <div className="text-[11px] opacity-80">Increases customer outstanding balance</div>
                  </button>
                </div>
              </div>

              <label className="block">
                <span className="text-xs text-[var(--text-muted)] mb-1 block">Adjustment Amount (₹) *</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  className="w-full px-4 py-2 text-sm font-mono rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                />
              </label>

              {/* Quick Reason Chips */}
              <div>
                <span className="text-[11px] text-[var(--text-muted)] mb-1.5 block">Suggested Reasons:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Opening Balance (आरंभिक शेष)",
                    "Round-off Waiver",
                    "Diwali / Festive Discount",
                    "Damaged Goods Allowance",
                    "Transport & Unloading Charges",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setDescription(chip)}
                      className="px-2.5 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Description & Notes */}
          <div className="space-y-3 pt-2 border-t border-[var(--border)]">
            <label className="block">
              <span className="text-xs text-[var(--text-muted)] mb-1 block">
                Particulars / Description (विवरण)
              </span>
              <input
                type="text"
                maxLength={1000}
                placeholder="Particulars (e.g. अलमारी के लिए पत्थर या विशेष विवरण)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
              />
            </label>

            <label className="block">
              <span className="text-xs text-[var(--text-muted)] mb-1 block">Internal Notes (Optional)</span>
              <textarea
                rows={2}
                maxLength={2000}
                placeholder="Internal accounting or logistics notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition resize-none"
              />
            </label>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-bold rounded-[var(--radius-md)] bg-[var(--gold)] text-black hover:bg-[var(--gold-light)] shadow-[0_0_15px_rgba(251,191,36,0.2)] disabled:opacity-50 transition"
            >
              {isSubmitting ? "Saving..." : "Save Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CreateTransactionModal(props: CreateTransactionModalProps) {
  const isVisible = props.open ?? props.isOpen ?? false;
  if (!isVisible) return null;

  return (
    <CreateTransactionModalContent
      key={`${props.initialType || props.defaultType || "SALE"}`}
      {...props}
    />
  );
}

