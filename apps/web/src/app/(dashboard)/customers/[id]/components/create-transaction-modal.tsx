"use client";

import { useState, useMemo } from "react";
import { X, Plus, Trash2, Calendar, Receipt, CreditCard, RefreshCw, SlidersHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import { formatINR } from "@/lib/utils";
import { useCreateCustomerTransaction, useProducts } from "@/hooks/api-hooks";
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

interface FormItem {
  id: string;
  productId?: string;
  productName: string;
  quantity: number | "";
  unitPrice: number | "";
  unit: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  sellingPrice?: number;
  unit?: string;
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

  const { data: prodData } = useProducts({ limit: 100, isActive: true });
  const catalogProducts: CatalogProduct[] =
    (prodData as { data?: { data?: CatalogProduct[] } | CatalogProduct[] })?.data &&
    Array.isArray((prodData as { data?: { data?: CatalogProduct[] } }).data?.data)
      ? (prodData as { data: { data: CatalogProduct[] } }).data.data
      : Array.isArray((prodData as { data?: CatalogProduct[] })?.data)
      ? (prodData as { data: CatalogProduct[] }).data
      : [];

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

  const handleProductSelect = (index: number, productName: string) => {
    const product = catalogProducts.find(
      (p: CatalogProduct) => p.name && p.name.toLowerCase() === productName.toLowerCase()
    );
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (product) {
          return {
            ...item,
            productId: product.id,
            productName: product.name,
            unit: product.unit || "PCS",
            unitPrice: product.sellingPrice || 0,
          };
        }
        return { ...item, productName };
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
        className="relative w-full max-w-3xl bg-[var(--bg-primary)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
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

              {/* Datalist for Product Master Autocomplete */}
              {catalogProducts.length > 0 && (
                <datalist id="catalog-products-list">
                  {catalogProducts.map((p: CatalogProduct) => (
                    <option key={p.id} value={p.name}>
                      {p.name} — ₹{p.sellingPrice} / {p.unit}
                    </option>
                  ))}
                </datalist>
              )}

              <div className="space-y-2">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold px-1">
                  <div>Item Name / Description (Hindi/Eng)</div>
                  <div>Quantity</div>
                  <div>Unit</div>
                  <div>Rate (₹)</div>
                  <div className="text-right">Amount (₹)</div>
                  <div className="w-8"></div>
                </div>

                {items.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                    <input
                      type="text"
                      list="catalog-products-list"
                      placeholder="Item Name (e.g. अलमारी के लिए पत्थर)"
                      value={item.productName}
                      onChange={(e) => handleProductSelect(idx, e.target.value)}
                      className="px-3 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                    />

                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="Qty"
                      value={item.quantity === "" ? "" : item.quantity}
                      onChange={(e) =>
                        handleItemChange(idx, "quantity", e.target.value === "" ? "" : parseFloat(e.target.value))
                      }
                      className="px-3 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                    />

                    <input
                      type="text"
                      placeholder="Unit"
                      value={item.unit}
                      onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                      className="px-2 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                    />

                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Rate"
                      value={item.unitPrice === "" ? "" : item.unitPrice}
                      onChange={(e) =>
                        handleItemChange(idx, "unitPrice", e.target.value === "" ? "" : parseFloat(e.target.value))
                      }
                      className="px-3 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                    />

                    <div className="text-right font-mono text-sm font-semibold text-[var(--text-primary)] px-2">
                      {formatINR((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                    </div>

                    <button
                      type="button"
                      disabled={items.length === 1 && !item.productName}
                      onClick={() => handleRemoveItem(idx)}
                      className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 transition disabled:opacity-30"
                      aria-label="Remove item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

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
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold px-1">
                    <div>Item Name / Hindi Particulars</div>
                    <div>Qty</div>
                    <div>Unit</div>
                    <div>Rate (₹)</div>
                    <div className="text-right">Amount (₹)</div>
                    <div className="w-8"></div>
                  </div>

                  {items.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Item Name (e.g. टूटा हुआ पत्थर)"
                        value={item.productName}
                        onChange={(e) => handleItemChange(idx, "productName", e.target.value)}
                        className="px-3 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                      />
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder="Qty"
                        value={item.quantity === "" ? "" : item.quantity}
                        onChange={(e) =>
                          handleItemChange(idx, "quantity", e.target.value === "" ? "" : parseFloat(e.target.value))
                        }
                        className="px-3 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                      />
                      <input
                        type="text"
                        placeholder="Unit"
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                        className="px-2 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                      />
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Rate"
                        value={item.unitPrice === "" ? "" : item.unitPrice}
                        onChange={(e) =>
                          handleItemChange(idx, "unitPrice", e.target.value === "" ? "" : parseFloat(e.target.value))
                        }
                        className="px-3 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                      />
                      <div className="text-right font-mono text-sm font-semibold text-[var(--orange)] px-2">
                        {formatINR((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-red-400"
                        aria-label="Remove item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
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

