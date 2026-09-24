"use client";

import { useState, useMemo } from "react";
import { X, Plus, Trash2, Calendar, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import { formatINR } from "@/lib/utils";
import { useUpdateCustomerTransaction } from "@/hooks/api-hooks";
import type {
  LedgerEntryWithBalance,
  PaymentMethod,
  CreateTransactionItemDto,
  UpdateTransactionDto,
} from "@/types/customer-transactions";

interface EditTransactionModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  customerId: string;
  customerName?: string;
  transaction: LedgerEntryWithBalance | null;
  onSubmit?: (data: { id: string; data: UpdateTransactionDto }) => void;
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

function EditTransactionModalContent({
  customerId,
  customerName,
  transaction,
  onClose,
  onSubmit,
  isPending: externalIsPending,
}: {
  customerId: string;
  customerName: string;
  transaction: LedgerEntryWithBalance;
  onClose: () => void;
  onSubmit?: (data: { id: string; data: UpdateTransactionDto }) => void;
  isPending?: boolean;
}) {
  const updateTx = useUpdateCustomerTransaction(customerId);
  const isSubmitting = externalIsPending ?? updateTx.isPending;

  const [date, setDate] = useState<string>(() => transaction.date || new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState<string>(() => transaction.description || "");
  const [reference, setReference] = useState<string>(() => transaction.reference || "");
  const [notes, setNotes] = useState<string>(() => transaction.notes || "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => (transaction.paymentMethod as PaymentMethod) || "CASH");
  const [amount, setAmount] = useState<string>(() => {
    if (transaction.type === "ADJUSTMENT") {
      return String(Math.abs(transaction.amount));
    }
    return String(transaction.amount);
  });
  const [adjustmentDirection, setAdjustmentDirection] = useState<"DEBIT" | "CREDIT">(() => {
    if (transaction.type === "ADJUSTMENT" && transaction.amount > 0) {
      return "DEBIT";
    }
    return "CREDIT";
  });
  const [items, setItems] = useState<FormItem[]>(() => {
    if (transaction.items && transaction.items.length > 0) {
      return transaction.items.map((it) => ({
        id: it.id,
        productId: it.productId || undefined,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        unit: it.unit || "PCS",
      }));
    }
    return [];
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalAmount = 0;
    let payloadItems: CreateTransactionItemDto[] | undefined = undefined;

    if (transaction.type === "SALE" || transaction.type === "RETURN") {
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
        finalAmount = Number(amount) || 0;
      }
    } else if (transaction.type === "PAYMENT") {
      finalAmount = Number(amount) || 0;
    } else if (transaction.type === "ADJUSTMENT") {
      const rawAdj = Math.abs(Number(amount));
      finalAmount = adjustmentDirection === "CREDIT" ? -rawAdj : rawAdj;
    }

    if (
      (transaction.type !== "ADJUSTMENT" && finalAmount <= 0) ||
      (transaction.type === "ADJUSTMENT" && finalAmount === 0)
    ) {
      toast.error("Please enter a valid transaction amount or line items");
      return;
    }

    const payload: UpdateTransactionDto = {
      date,
      amount: Math.round(finalAmount * 100) / 100,
      description: description.trim() || undefined,
      paymentMethod: transaction.type === "PAYMENT" ? paymentMethod : undefined,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      items: payloadItems,
    };

    if (onSubmit) {
      onSubmit({ id: transaction.id, data: payload });
      return;
    }

    updateTx.mutate(
      {
        id: transaction.id,
        data: payload,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
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
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>
                Edit Transaction
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20">
                {transaction.type}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Customer: <span className="text-[var(--gold)] font-medium">{customerName}</span> | Transaction ID:{" "}
              <span className="font-mono text-[var(--text-muted)]">{transaction.id.slice(0, 8)}...</span>
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

        {/* Audit Trail Notice */}
        <div className="px-5 py-2.5 bg-[var(--gold)]/5 border-b border-[var(--gold)]/15 flex items-center gap-2 text-xs text-[var(--gold)]">
          <ShieldAlert size={14} className="shrink-0" />
          <span>
            Edits are recorded in the immutable audit log and instantaneously recalculate the customer&apos;s balance.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Date & Reference */}
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
              <span className="text-xs text-[var(--text-muted)] mb-1 block">Reference / Bill / UTR</span>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
              />
            </label>
          </div>

          {/* Line items if SALE / RETURN */}
          {(transaction.type === "SALE" || transaction.type === "RETURN") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Line Items Breakdown
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1 text-xs text-[var(--gold)] hover:text-[var(--gold-light)] font-medium"
                >
                  <Plus size={14} /> Add Row
                </button>
              </div>

              {items.length === 0 ? (
                <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">No line items recorded. Flat Amount:</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-40 px-3 py-1.5 text-sm font-mono rounded bg-[var(--bg-primary)] border border-[var(--border)] text-right"
                  />
                </div>
              ) : (
                <div className="space-y-2">
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
                        value={item.productName}
                        onChange={(e) => handleItemChange(idx, "productName", e.target.value)}
                        className="px-3 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                      />
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.quantity === "" ? "" : item.quantity}
                        onChange={(e) =>
                          handleItemChange(idx, "quantity", e.target.value === "" ? "" : parseFloat(e.target.value))
                        }
                        className="px-3 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                      />
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                        className="px-2 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                      />
                      <input
                        type="number"
                        min="0"
                        step="any"
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
                        onClick={() => handleRemoveItem(idx)}
                        className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-red-400"
                        aria-label="Remove item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}

                  <div className="flex justify-between items-center p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
                    <span className="text-xs text-[var(--text-muted)]">Calculated Total:</span>
                    <span className="text-base font-bold font-mono text-[var(--green-bright)]">
                      {formatINR(itemsTotal)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Specific */}
          {transaction.type === "PAYMENT" && (
            <div className="space-y-4">
              <div>
                <span className="text-xs text-[var(--text-muted)] mb-2 block">Payment Method</span>
                <div className="grid grid-cols-4 gap-2">
                  {(["CASH", "UPI", "CHEQUE", "BANK_TRANSFER"] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 text-xs font-bold rounded-md border transition uppercase tracking-wider ${
                        paymentMethod === m
                          ? "bg-[var(--gold)] text-black border-[var(--gold)]"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      {m.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-xs text-[var(--text-muted)] mb-1 block">Payment Amount (₹) *</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2 font-mono font-bold text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--green-bright)] focus:border-[var(--gold)] focus:outline-none transition"
                />
              </label>
            </div>
          )}

          {/* Adjustment Specific */}
          {transaction.type === "ADJUSTMENT" && (
            <div className="space-y-4">
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
                  <div className="text-[11px] opacity-80">Reduces balance</div>
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
                  <div className="text-[11px] opacity-80">Increases balance</div>
                </button>
              </div>

              <label className="block">
                <span className="text-xs text-[var(--text-muted)] mb-1 block">Adjustment Amount (₹) *</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2 text-sm font-mono rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
                />
              </label>
            </div>
          )}

          {/* Description & Notes */}
          <div className="space-y-3 pt-2 border-t border-[var(--border)]">
            <label className="block">
              <span className="text-xs text-[var(--text-muted)] mb-1 block">Particulars / Description</span>
              <input
                type="text"
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
              />
            </label>

            <label className="block">
              <span className="text-xs text-[var(--text-muted)] mb-1 block">Internal Notes</span>
              <textarea
                rows={2}
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition resize-none"
              />
            </label>
          </div>

          {/* Action buttons */}
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
              {isSubmitting ? "Updating..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditTransactionModal({
  open,
  isOpen,
  onClose,
  customerId,
  customerName = "Customer",
  transaction,
  onSubmit,
  isPending: externalIsPending,
}: EditTransactionModalProps) {
  const isVisible = open ?? isOpen ?? false;
  if (!isVisible || !transaction) return null;

  return (
    <EditTransactionModalContent
      key={transaction.id}
      customerId={customerId}
      customerName={customerName}
      transaction={transaction}
      onClose={onClose}
      onSubmit={onSubmit}
      isPending={externalIsPending}
    />
  );
}
