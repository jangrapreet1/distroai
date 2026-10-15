"use client";

import { useState } from "react";
import { X, CreditCard, Calendar, FileText, CheckCircle2 } from "lucide-react";
import { useRecordSupplierPayment } from "@/hooks/api-hooks";
import { formatINR } from "@/lib/utils";

interface PurchaseOrderOption {
  id: string;
  poNumber: string;
  netAmount?: number;
  totalAmount?: number;
  status?: string;
}

interface RecordSupplierPaymentModalProps {
  open: boolean;
  onClose: () => void;
  supplierId: string;
  supplierName: string;
  purchaseOrders?: PurchaseOrderOption[];
  onSuccess?: () => void;
}

export function RecordSupplierPaymentModal({
  open,
  onClose,
  supplierId,
  supplierName,
  purchaseOrders = [],
  onSuccess,
}: RecordSupplierPaymentModalProps) {
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE">("UPI");
  const [purchaseOrderId, setPurchaseOrderId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const recordPayment = useRecordSupplierPayment();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return;
    }

    try {
      await recordPayment.mutateAsync({
        supplierId,
        data: {
          amount: numericAmount,
          date,
          paymentMethod,
          notes: notes.trim() || undefined,
          purchaseOrderId: purchaseOrderId || undefined,
        },
      });
      setAmount("");
      setNotes("");
      setPurchaseOrderId("");
      onSuccess?.();
      onClose();
    } catch {
      // toast is already handled in the hook
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--green-bright)]/10 flex items-center justify-center border border-[var(--green-bright)]/20 text-[var(--green-bright)]">
              <CreditCard size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                Record Supplier Payment
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Vendor: <span className="font-semibold text-[var(--text-primary)]">{supplierName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 rounded-full transition"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Payment Amount (₹) <span className="text-[var(--red)]">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--text-muted)]">₹</span>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Payment Date */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 flex items-center gap-1">
                <Calendar size={13} /> Payment Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                Payment Mode
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none"
              >
                <option value="UPI">UPI / QR</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          {/* Linked Purchase Order (optional) */}
          {purchaseOrders.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 flex items-center gap-1">
                <FileText size={13} /> Link to Purchase Order (Optional)
              </label>
              <select
                value={purchaseOrderId}
                onChange={(e) => setPurchaseOrderId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none"
              >
                <option value="">General Payment (Not tied to specific PO)</option>
                {purchaseOrders.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} — {formatINR(po.netAmount ?? po.totalAmount ?? 0)} ({po.status || "PO"})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reference / Notes */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Reference / Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. UTR number, Cheque #019283, advance payment"
              className="w-full px-3 py-2 text-xs rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={recordPayment.isPending}
              className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-md)] transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recordPayment.isPending || !amount || parseFloat(amount) <= 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-[var(--radius-md)] bg-[var(--green-bright)] text-black hover:opacity-90 shadow-md transition disabled:opacity-50"
            >
              <CheckCircle2 size={14} className={recordPayment.isPending ? "animate-spin" : ""} />
              {recordPayment.isPending ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
