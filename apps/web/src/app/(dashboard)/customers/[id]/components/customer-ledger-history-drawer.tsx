"use client";

import { useState, useMemo } from "react";
import {
  X,
  Clock,
  User,
  ArrowRight,
  History,
  FileSpreadsheet,
  Trash2,
  Pencil,
  PlusCircle,
  Filter,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatDate, formatINR } from "@/lib/utils";
import { useCustomerLedgerLogs } from "@/hooks/api-hooks";

interface CustomerLedgerHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName?: string;
}

type FilterAction = "ALL" | "UPDATE" | "DELETE" | "IMPORT" | "CREATE";

export function CustomerLedgerHistoryDrawer({
  open,
  onClose,
  customerId,
  customerName = "Customer",
}: CustomerLedgerHistoryDrawerProps) {
  const [activeFilter, setActiveFilter] = useState<FilterAction>("ALL");

  const { data, isLoading, refetch } = useCustomerLedgerLogs(customerId, {
    limit: 100,
  });

  const rawLogs = data?.logs ?? [];

  const filteredLogs = useMemo(() => {
    if (activeFilter === "ALL") return rawLogs;
    return rawLogs.filter((l) => l.action === activeFilter);
  }, [rawLogs, activeFilter]);

  const counts = useMemo(() => {
    const res = { ALL: rawLogs.length, UPDATE: 0, DELETE: 0, IMPORT: 0, CREATE: 0 };
    for (const l of rawLogs) {
      if (l.action === "UPDATE") res.UPDATE++;
      else if (l.action === "DELETE") res.DELETE++;
      else if (l.action === "IMPORT") res.IMPORT++;
      else if (l.action === "CREATE") res.CREATE++;
    }
    return res;
  }, [rawLogs]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[var(--bg-primary)] border-l border-[var(--border)] shadow-2xl flex flex-col transform transition-transform ease-out duration-300">
          {/* Header */}
          <div className="p-5 border-b border-[var(--border)] bg-[var(--bg-secondary)]/60 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] shrink-0">
                <History size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Ledger History & Logs
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Audit trail for <span className="font-semibold text-[var(--text-secondary)]">{customerName}</span>
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

          {/* Filter Bar */}
          <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-primary)] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeFilter === "ALL"
                  ? "bg-[var(--gold)] text-black shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5"
              }`}
            >
              All ({counts.ALL})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("UPDATE")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeFilter === "UPDATE"
                  ? "bg-amber-500 text-black shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5"
              }`}
            >
              Edits ({counts.UPDATE})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("IMPORT")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeFilter === "IMPORT"
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5"
              }`}
            >
              Imports ({counts.IMPORT})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("DELETE")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeFilter === "DELETE"
                  ? "bg-red-500 text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5"
              }`}
            >
              Deletions ({counts.DELETE})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("CREATE")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeFilter === "CREATE"
                  ? "bg-emerald-500 text-black shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5"
              }`}
            >
              Created ({counts.CREATE})
            </button>
          </div>

          {/* Activity Timeline List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {isLoading ? (
              <div className="py-20 text-center text-xs text-[var(--text-muted)]">
                <div className="w-7 h-7 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading chronological activity...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-16 text-center text-xs text-[var(--text-muted)] space-y-2">
                <Clock size={32} className="mx-auto opacity-30 text-[var(--gold)]" />
                <p className="font-semibold text-sm text-[var(--text-secondary)]">No logs found</p>
                <p className="text-xs">
                  {activeFilter === "ALL"
                    ? "No changes or imports have been recorded for this ledger."
                    : `No ${activeFilter.toLowerCase()} events recorded.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => {
                  const dateObj = new Date(log.createdAt);
                  const isUpdate = log.action === "UPDATE";
                  const isDelete = log.action === "DELETE";
                  const isImport = log.action === "IMPORT";
                  const isCreate = log.action === "CREATE";

                  return (
                    <div
                      key={log.id}
                      className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--gold)]/30 transition space-y-2"
                    >
                      {/* Top Bar: Action Badge + Time */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isUpdate
                                ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                : isDelete
                                ? "bg-red-500/15 text-red-400 border border-red-500/30"
                                : isImport
                                ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            }`}
                          >
                            {isUpdate && <Pencil size={10} />}
                            {isDelete && <Trash2 size={10} />}
                            {isImport && <FileSpreadsheet size={10} />}
                            {isCreate && <PlusCircle size={10} />}
                            <span>{log.action}</span>
                          </span>

                          <span className="font-semibold text-[var(--text-primary)] text-xs flex items-center gap-1">
                            <User size={11} className="text-[var(--gold)]" />
                            {log.user.name}
                          </span>
                        </div>

                        <span
                          className="text-[11px] text-[var(--text-muted)] font-mono"
                          title={dateObj.toLocaleString()}
                        >
                          {formatDistanceToNow(dateObj, { addSuffix: true })}
                        </span>
                      </div>

                      {/* Summary Text */}
                      <p className="text-xs font-medium text-[var(--text-secondary)] leading-relaxed">
                        {log.summary}
                      </p>

                      {/* Before / After Badges for Edits */}
                      {log.changes && log.changes.length > 0 && (
                        <div className="pt-2 mt-2 border-t border-[var(--border)]/60 space-y-1.5 text-[11px]">
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

                      {/* Exact Date Timestamp */}
                      <div className="pt-1 text-[10px] text-[var(--text-muted)] font-mono">
                        {dateObj.toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        at{" "}
                        {dateObj.toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-secondary)]/40 flex justify-between items-center text-xs">
            <span className="text-[var(--text-muted)]">
              Showing {filteredLogs.length} events
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 font-semibold text-[var(--text-primary)] transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
