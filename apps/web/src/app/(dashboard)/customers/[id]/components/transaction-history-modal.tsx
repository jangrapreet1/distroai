"use client";

import { X, Clock, User, ArrowRight, CheckCircle2, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatDate, formatINR } from "@/lib/utils";
import { useCustomerLedgerLogs } from "@/hooks/api-hooks";
import type { LedgerEntryWithBalance } from "@/types/customer-transactions";

interface TransactionHistoryModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  transaction: LedgerEntryWithBalance | null;
}

export function TransactionHistoryModal({
  open,
  onClose,
  customerId,
  transaction,
}: TransactionHistoryModalProps) {
  const { data, isLoading } = useCustomerLedgerLogs(customerId, {
    transactionId: transaction?.id,
    limit: 20,
  });

  if (!open || !transaction) return null;

  const logs = data?.logs ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-[var(--bg-primary)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)]">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Transaction Change History
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {transaction.description || transaction.type} • {formatDate(transaction.date)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              <div className="w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading change history...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)] space-y-2">
              <Clock size={28} className="mx-auto opacity-30 text-[var(--gold)]" />
              <p className="font-medium text-[var(--text-secondary)]">No edit logs found</p>
              <p className="text-[11px]">This transaction has not had recorded changes since initial creation.</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border)]">
              {logs.map((log) => {
                const dateObj = new Date(log.createdAt);
                const isUpdate = log.action === "UPDATE";
                const isCreate = log.action === "CREATE";

                return (
                  <div key={log.id} className="relative group">
                    {/* Timeline dot */}
                    <div
                      className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] ${
                        isUpdate
                          ? "bg-amber-500/20 border-amber-500 text-amber-500"
                          : isCreate
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-500"
                          : "bg-blue-500/20 border-blue-500 text-blue-500"
                      }`}
                    >
                      <Clock size={10} />
                    </div>

                    <div className="rounded-xl p-3.5 bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2 group-hover:border-[var(--gold)]/30 transition">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                          <User size={12} className="text-[var(--gold)]" />
                          {log.user.name}
                        </span>
                        <span
                          className="text-[11px] text-[var(--text-muted)] font-mono"
                          title={dateObj.toLocaleString()}
                        >
                          {formatDistanceToNow(dateObj, { addSuffix: true })}
                        </span>
                      </div>

                      <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {log.summary}
                      </div>

                      {/* Explicit Before & After Badges for updates */}
                      {log.changes && log.changes.length > 0 && (
                        <div className="pt-1.5 space-y-1.5 border-t border-[var(--border)]/60 text-[11px]">
                          {log.changes.map((c, idx) => (
                            <div key={idx} className="flex items-center justify-between py-0.5">
                              <span className="text-[var(--text-muted)] font-medium">
                                {c.label}:
                              </span>
                              <div className="flex items-center gap-1.5 font-mono">
                                <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 line-through">
                                  {typeof c.oldValue === "number" && c.field.toLowerCase().includes("amount")
                                    ? formatINR(c.oldValue)
                                    : String(c.oldValue ?? "—")}
                                </span>
                                <ArrowRight size={11} className="text-[var(--text-muted)]" />
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">
                                  {typeof c.newValue === "number" && c.field.toLowerCase().includes("amount")
                                    ? formatINR(c.newValue)
                                    : String(c.newValue ?? "—")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-secondary)]/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[var(--text-primary)] transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
