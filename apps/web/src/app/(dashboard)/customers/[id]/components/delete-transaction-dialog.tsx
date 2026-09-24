"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { formatDate, formatINR } from "@/lib/utils";
import { useDeleteCustomerTransaction } from "@/hooks/api-hooks";
import type { LedgerEntryWithBalance } from "@/types/customer-transactions";

interface DeleteTransactionDialogProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  transaction: LedgerEntryWithBalance | null;
  onSubmit?: (id: string) => void;
}

export function DeleteTransactionDialog({
  open,
  isOpen,
  onClose,
  customerId,
  customerName,
  transaction,
  onSubmit,
}: DeleteTransactionDialogProps) {
  const isVisible = open ?? isOpen ?? false;
  const deleteTx = useDeleteCustomerTransaction(customerId);

  if (!isVisible || !transaction) return null;

  const handleDelete = () => {
    if (onSubmit) {
      onSubmit(transaction.id);
      return;
    }
    deleteTx?.mutate?.(transaction.id, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  const getImpactDescription = () => {
    switch (transaction.type) {
      case "SALE":
        return `Deleting this sale will decrease ${customerName}'s outstanding balance by ${formatINR(transaction.amount)}.`;
      case "PAYMENT":
        return `Deleting this payment will increase ${customerName}'s outstanding balance by ${formatINR(transaction.amount)} (reversing the payment).`;
      case "RETURN":
        return `Deleting this return will increase ${customerName}'s outstanding balance by ${formatINR(transaction.amount)} (reversing the return credit).`;
      case "ADJUSTMENT":
        return `Deleting this adjustment will reverse the adjustment effect of ${formatINR(transaction.amount)} on ${customerName}'s balance.`;
      default:
        return "This will permanently recalculate customer balances.";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[var(--bg-primary)] border border-red-500/30 rounded-[var(--radius-lg)] shadow-2xl p-6 space-y-5 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 text-red-500">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
              Delete Transaction?
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              This action cannot be undone. The transaction will be permanently removed from all ledger statements.
            </p>
          </div>
        </div>

        {/* Transaction Summary Card */}
        <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">Date:</span>
            <span className="font-semibold text-[var(--text-primary)]">{formatDate(transaction.date)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">Type:</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20">
              {transaction.type}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">Amount:</span>
            <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
              {formatINR(transaction.amount)}
            </span>
          </div>
          {transaction.description && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Particulars:</span>
              <span className="text-[var(--text-secondary)] truncate max-w-[200px]">
                {transaction.description}
              </span>
            </div>
          )}
          {transaction.items && transaction.items.length > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Items:</span>
              <span className="text-[var(--text-secondary)]">{transaction.items.length} line items</span>
            </div>
          )}
        </div>

        {/* Impact Warning */}
        <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-300">
          <p className="font-medium">{getImpactDescription()}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleteTx?.isPending}
            className="px-4 py-2 text-sm font-semibold rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteTx?.isPending}
            className="px-5 py-2 text-sm font-bold rounded-[var(--radius-md)] bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.3)] disabled:opacity-50 transition"
          >
            <Trash2 size={15} />
            {deleteTx.isPending ? "Deleting..." : "Delete Transaction"}
          </button>
        </div>
      </div>
    </div>
  );
}
