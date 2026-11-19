"use client";

import { useState, useMemo, useEffect } from "react";
import { X, CreditCard, Calendar, Check, DollarSign, FileText, Hash } from "lucide-react";
import { formatINR } from "@/lib/utils";
import toast from "react-hot-toast";
import { useBulkOrderAction, useOrderAction } from "@/hooks/api-hooks";

export type OrderPaymentMethod = "CASH" | "UPI" | "CHEQUE" | "BANK_TRANSFER";

export interface OrderToPay {
  id: string;
  orderNumber: string;
  customerName?: string;
  netAmount: number;
  paidAmount?: number;
  balanceAmount?: number;
  invoiceBalance?: number;
}

interface MarkPaidModalProps {
  open: boolean;
  onClose: () => void;
  orders: OrderToPay[];
  onSuccess?: () => void;
}

export function MarkPaidModal({ open, onClose, orders, onSuccess }: MarkPaidModalProps) {
  if (!open || orders.length === 0) return null;

  return <MarkPaidModalContent onClose={onClose} orders={orders} onSuccess={onSuccess} />;
}

function MarkPaidModalContent({
  onClose,
  orders,
  onSuccess,
}: {
  onClose: () => void;
  orders: OrderToPay[];
  onSuccess?: () => void;
}) {
  const bulkOrderAction = useBulkOrderAction();
  const singleOrderAction = useOrderAction();
  const isPending = bulkOrderAction.isPending || singleOrderAction.isPending;

  // Calculate total balance due
  const totalBalanceDue = useMemo(() => {
    return orders.reduce((sum, o) => {
      const bal = o.invoiceBalance != null
        ? o.invoiceBalance
        : o.balanceAmount != null
        ? o.balanceAmount
        : Math.max(0, o.netAmount - (o.paidAmount ?? 0));
      return sum + Math.max(0, bal);
    }, 0);
  }, [orders]);

  const [date, setDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState<OrderPaymentMethod>("CASH");
  const [amount, setAmount] = useState<string>(() => String(totalBalanceDue || ""));
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    setAmount(String(totalBalanceDue || ""));
  }, [totalBalanceDue]);

  const customerName = orders[0]?.customerName || "Customer";
  const isMultiple = orders.length > 1;

  const handleQuickFill = (pct: number) => {
    const val = Math.round((totalBalanceDue * pct) * 100) / 100;
    setAmount(String(val));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid positive payment amount");
      return;
    }

    const payload = {
      method,
      amount: parsedAmount,
      date,
      referenceNumber: referenceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (orders.length === 1) {
      singleOrderAction.mutate(
        {
          id: orders[0].id,
          action: "mark-paid",
          data: payload,
        },
        {
          onSuccess: () => {
            toast.success(`Payment of ${formatINR(parsedAmount)} recorded for ${orders[0].orderNumber}`);
            onSuccess?.();
            onClose();
          },
        }
      );
    } else {
      bulkOrderAction.mutate(
        {
          ids: orders.map((o) => o.id),
          action: "mark-paid",
          data: payload,
        },
        {
          onSuccess: () => {
            onSuccess?.();
            onClose();
          },
        }
      );
    }
  };

  const paymentModes: Array<{ key: OrderPaymentMethod; label: string; icon: string }> = [
    { key: "CASH", label: "Cash (रोकड़)", icon: "💵" },
    { key: "UPI", label: "UPI (GPay / PhonePe)", icon: "📱" },
    { key: "CHEQUE", label: "Cheque (चेक)", icon: "📜" },
    { key: "BANK_TRANSFER", label: "Bank / NEFT", icon: "🏦" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-[var(--bg-primary)] border-t sm:border border-[var(--border)] rounded-t-2xl sm:rounded-[var(--radius-lg)] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-white/[0.02]">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[var(--green-bright)]/10 text-[var(--green-bright)] border border-[var(--green-bright)]/20">
                <CreditCard size={18} />
              </span>
              <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair)" }}>
                Record Payment & Mark Paid
              </h2>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {isMultiple
                ? `${orders.length} orders selected (${orders.map((o) => o.orderNumber).join(", ")})`
                : `Order ${orders[0].orderNumber} • Customer: `}
              {!isMultiple && <span className="text-[var(--gold)] font-medium">{customerName}</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {/* Order Summary Pill */}
          <div className="p-3.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider block font-medium">
                {isMultiple ? "Total Balance Due" : "Order Balance Due"}
              </span>
              <span className="text-base font-bold font-mono text-[var(--gold)]">
                {formatINR(totalBalanceDue)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20 font-semibold uppercase">
                {isMultiple ? `${orders.length} Orders` : orders[0].orderNumber}
              </span>
            </div>
          </div>

          {/* Date & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-[var(--text-secondary)] font-medium mb-1.5 flex items-center gap-1.5">
                <Calendar size={13} className="text-[var(--gold)]" /> Payment Date (तारीख) *
              </span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition cursor-pointer"
              />
            </label>

            <label className="block">
              <span className="text-xs text-[var(--text-secondary)] font-medium mb-1.5 flex items-center gap-1.5">
                <Hash size={13} className="text-[var(--gold)]" /> Reference / UTR / Cheque No.
              </span>
              <input
                type="text"
                placeholder="e.g. UPI/2026/89472 or Cheque #1042"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
              />
            </label>
          </div>

          {/* Payment Mode Selector */}
          <div>
            <span className="text-xs text-[var(--text-secondary)] font-medium mb-2 block">
              Payment Mode (माध्यम) *
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {paymentModes.map((pm) => {
                const isSelected = method === pm.key;
                return (
                  <button
                    key={pm.key}
                    type="button"
                    onClick={() => setMethod(pm.key)}
                    className={`py-2 px-3 text-xs font-semibold rounded-[var(--radius-md)] border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-[var(--gold)] text-black border-[var(--gold)] shadow-sm"
                        : "bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--gold)]/40 hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span>{pm.icon}</span>
                    <span>{pm.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Amount with Quick Fills */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[var(--text-secondary)] font-medium flex items-center gap-1">
                <DollarSign size={13} className="text-[var(--green-bright)]" /> Amount Received (प्राप्त राशि ₹) *
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--text-muted)]">Quick fill:</span>
                <button
                  type="button"
                  onClick={() => handleQuickFill(1)}
                  className="px-2 py-0.5 text-[10px] rounded bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20 hover:bg-[var(--gold)]/20 transition font-mono font-medium"
                >
                  Full ({formatINR(totalBalanceDue)})
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill(0.5)}
                  className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-[var(--text-secondary)] border border-[var(--border)] hover:bg-white/10 transition font-mono"
                >
                  50% ({formatINR(totalBalanceDue * 0.5)})
                </button>
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--green-bright)]">
                ₹
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 text-base font-mono font-bold rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-[var(--green-bright)] focus:border-[var(--gold)] focus:outline-none transition shadow-inner"
              />
            </div>
          </div>

          {/* Notes / Description */}
          <label className="block">
            <span className="text-xs text-[var(--text-secondary)] font-medium mb-1.5 flex items-center gap-1.5">
              <FileText size={13} className="text-[var(--text-muted)]" /> Particulars / Internal Notes (Optional)
            </span>
            <input
              type="text"
              placeholder="e.g. Paid via GPay to delivery boy, cleared in HDFC"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition"
            />
          </label>

          {/* Informational Sync Notice */}
          <div className="p-3 rounded-lg bg-[var(--gold)]/10 border border-[var(--gold)]/20 text-[11px] text-[var(--gold)] flex items-start gap-2">
            <span className="mt-0.5">⚡</span>
            <span>
              <strong>Auto-Syncs Khata:</strong> Recording this payment will automatically allocate to the invoice, post a CREDIT entry to the Customer Ledger, and reduce customer balance.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-white/5 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 text-xs font-bold rounded-[var(--radius-md)] bg-[var(--gold)] text-black hover:bg-[var(--gold-light)] transition shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Check size={14} /> Confirm & Mark as Paid
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
