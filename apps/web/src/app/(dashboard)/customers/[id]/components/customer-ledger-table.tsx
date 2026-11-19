"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Search,
  Filter,
  Package,
  Clock,
  History,
} from "lucide-react";
import { TransactionHistoryModal } from "./transaction-history-modal";
import { CustomerLedgerHistoryDrawer } from "./customer-ledger-history-drawer";
import { formatDate, formatINR } from "@/lib/utils";
import { useCustomerLedger } from "@/hooks/api-hooks";
import type {
  LedgerEntryWithBalance,
  CustomerTransactionType,
  CustomerLedgerFilters,
} from "@/types/customer-transactions";
import { EditTransactionModal } from "./edit-transaction-modal";
import { DeleteTransactionDialog } from "./delete-transaction-dialog";
import { useIsMobile } from "@/hooks/use-is-mobile";

export interface CustomerLedgerTableProps {
  customerId?: string;
  customerName?: string;
  entries?: LedgerEntryWithBalance[];
  isLoading?: boolean;
  onEdit?: (transaction: LedgerEntryWithBalance) => void;
  onDelete?: (transaction: LedgerEntryWithBalance) => void;
}

export function CustomerLedgerTable({
  customerId = "",
  customerName = "Customer",
  entries: propEntries,
  isLoading: propIsLoading,
  onEdit,
  onDelete,
}: CustomerLedgerTableProps) {
  const [filters, setFilters] = useState<CustomerLedgerFilters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Modal states for internal handling when callbacks are not provided
  const [editingTransaction, setEditingTransaction] = useState<LedgerEntryWithBalance | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<LedgerEntryWithBalance | null>(null);
  const [selectedTxForHistory, setSelectedTxForHistory] = useState<LedgerEntryWithBalance | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const isMobile = useIsMobile(768);

  // TanStack query when customerId is provided and propEntries are not
  const { data: ledgerData, isLoading: queryIsLoading } = useCustomerLedger(
    propEntries ? "" : customerId,
    filters
  );

  const isLoading = propIsLoading ?? queryIsLoading;
  const rawEntries: LedgerEntryWithBalance[] = useMemo(() => {
    return propEntries ?? ledgerData?.entries ?? [];
  }, [propEntries, ledgerData]);

  // Strictly chronological ascending sort: date ASC, createdAt ASC, id ASC
  const sortedEntries = useMemo(() => {
    return [...rawEntries].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;

      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (createdA !== createdB) return createdA - createdB;

      return (a.id || "").localeCompare(b.id || "");
    });
  }, [rawEntries]);

  // Client-side search filtering
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return sortedEntries;
    const q = searchQuery.toLowerCase().trim();
    return sortedEntries.filter((entry) => {
      const descMatch = entry.description?.toLowerCase().includes(q);
      const typeMatch = entry.type?.toLowerCase().includes(q);
      const refMatch = entry.reference?.toLowerCase().includes(q);
      const itemMatch = entry.items?.some((it) => it.productName?.toLowerCase().includes(q));
      return descMatch || typeMatch || refMatch || itemMatch;
    });
  }, [sortedEntries, searchQuery]);

  const toggleRowExpansion = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleEditClick = (transaction: LedgerEntryWithBalance) => {
    if (onEdit) {
      onEdit(transaction);
    } else {
      setEditingTransaction(transaction);
    }
  };

  const handleDeleteClick = (transaction: LedgerEntryWithBalance) => {
    if (onDelete) {
      onDelete(transaction);
    } else {
      setDeletingTransaction(transaction);
    }
  };

  const getTypeBadge = (type: CustomerTransactionType) => {
    switch (type) {
      case "SALE":
        return "bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/20";
      case "RETURN":
        return "bg-[var(--orange)]/10 text-[var(--orange)] border-[var(--orange)]/20";
      case "PAYMENT":
        return "bg-[var(--green-bright)]/10 text-[var(--green-bright)] border-[var(--green-bright)]/20";
      case "ADJUSTMENT":
        return "bg-[var(--purple)]/20 text-[#A78BFA] border-[var(--purple)]/30";
      default:
        return "bg-white/10 text-[var(--text-secondary)] border-white/20";
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white/[0.02] border border-[var(--border)] rounded-[var(--radius-md)]">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search particulars, Hindi items, ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-[var(--text-muted)] shrink-0" />
            <select
              value={filters.type || ""}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  type: (e.target.value as CustomerTransactionType) || undefined,
                }))
              }
              aria-label="Filter by transaction type"
              className="px-2.5 py-1.5 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] focus:border-[var(--gold)] focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="SALE">Goods Given (SALE)</option>
              <option value="RETURN">Goods Returned (RETURN)</option>
              <option value="PAYMENT">Payment Received (PAYMENT)</option>
              <option value="ADJUSTMENT">Adjustments (ADJUSTMENT)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filters.startDate || ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, startDate: e.target.value || undefined }))
              }
              className="px-2 py-1.5 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] focus:border-[var(--gold)] focus:outline-none"
              title="Filter Start Date"
              aria-label="Start Date"
            />
            <span className="text-xs text-[var(--text-muted)]">to</span>
            <input
              type="date"
              value={filters.endDate || ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, endDate: e.target.value || undefined }))
              }
              className="px-2 py-1.5 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] focus:border-[var(--gold)] focus:outline-none"
              title="Filter End Date"
              aria-label="End Date"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowHistoryDrawer(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/50 transition shrink-0 ml-auto md:ml-1"
            title="View Ledger History & Change Logs"
          >
            <Clock size={13} className="text-[var(--gold)]" />
            <span>History</span>
          </button>
        </div>
      </div>

      {/* ─── Responsive Presentation: Mobile Cards (< 768px) vs Desktop Table (>= 768px) ─── */}
      {isMobile ? (
        <div className="space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            <div className="w-5 h-5 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading chronological ledger...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            <Package size={28} className="mx-auto mb-2 opacity-30" />
            No ledger transactions found
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isExpanded = expandedRows.has(entry.id);
            const hasItems = entry.items && entry.items.length > 0;
            const isDebit = entry.type === "SALE" || (entry.type === "ADJUSTMENT" && entry.amount > 0);
            const isCredit = entry.type === "RETURN" || entry.type === "PAYMENT" || (entry.type === "ADJUSTMENT" && entry.amount < 0);
            const debitAmount = isDebit ? Math.abs(entry.amount) : null;
            const creditAmount = isCredit ? Math.abs(entry.amount) : null;
            const balance = entry.runningBalance;
            const balanceSuffix = balance > 0 ? "Dr" : balance < 0 ? "Cr" : "Nil";
            const balanceColor = balance > 0 ? "text-[var(--red)]" : balance < 0 ? "text-[var(--green-bright)]" : "text-[var(--text-muted)]";

            return (
              <div
                key={entry.id}
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3.5 space-y-2.5 shadow-sm hover:border-[var(--gold)]/30 transition"
              >
                {/* Top row: Date + Type Badge + Edited Pill + Quick Actions */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {formatDate(entry.date)}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getTypeBadge(entry.type)}`}>
                      {entry.type}
                    </span>
                    {entry.updatedAt && entry.createdAt && new Date(entry.updatedAt).getTime() - new Date(entry.createdAt).getTime() > 2000 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTxForHistory(entry)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        title="Click to view change history"
                      >
                        <Clock size={10} />
                        <span>Edited</span>
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditClick(entry)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--gold)] hover:bg-[var(--bg-secondary)]"
                      title="Edit transaction"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(entry)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--red)] hover:bg-[var(--bg-secondary)]"
                      title="Delete transaction"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Description & Particulars */}
                {entry.description && (
                  <p className="text-xs text-[var(--text-primary)] font-medium leading-snug">
                    {entry.description}
                  </p>
                )}

                {/* Payment Method / Reference */}
                {(entry.paymentMethod || entry.reference) && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                    {entry.paymentMethod && <span className="font-semibold text-[var(--text-secondary)]">{entry.paymentMethod.replace("_", " ")}</span>}
                    {entry.paymentMethod && entry.reference && <span>•</span>}
                    {entry.reference && <span>Ref: {entry.reference}</span>}
                  </div>
                )}

                {/* Line Items Accordion */}
                {hasItems && (
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => toggleRowExpansion(entry.id)}
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--gold)] font-medium"
                    >
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <span>{entry.items.length} {entry.items.length === 1 ? "item" : "items"}</span>
                      <span className="text-[var(--text-muted)] font-normal truncate max-w-[150px]">
                        ({entry.items.map((it) => it.productName).join(", ")})
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="mt-2 p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] space-y-1.5 text-xs animate-in fade-in">
                        {entry.items.map((it, idx) => (
                          <div key={it.id || idx} className="flex items-center justify-between py-1 border-b border-[var(--border)]/40 last:border-0">
                            <div>
                              <p className="font-medium text-[var(--text-primary)]">{it.productName}</p>
                              <p className="text-[10px] text-[var(--text-muted)]">{it.quantity} {it.unit || "pcs"} @ ₹{it.unitPrice}</p>
                            </div>
                            <span className="font-mono font-semibold text-[var(--text-primary)]">{formatINR(it.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Row: Amount & Running Balance */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/60 text-xs">
                  <div>
                    {debitAmount !== null ? (
                      <div className="font-mono font-bold text-[var(--red)]">
                        +{formatINR(debitAmount)} <span className="text-[10px] font-semibold text-[var(--red)]/80">Dr (Given)</span>
                      </div>
                    ) : creditAmount !== null ? (
                      <div className="font-mono font-bold text-[var(--green-bright)]">
                        -{formatINR(creditAmount)} <span className="text-[10px] font-semibold text-[var(--green-bright)]/80">Cr (Received)</span>
                      </div>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-[var(--text-muted)] mr-1">Bal:</span>
                    <span className={`font-mono font-bold ${balanceColor}`}>
                      {formatINR(Math.abs(balance))} <span className="text-[10px] font-semibold">{balanceSuffix}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-white/[0.01] shadow-md">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-[var(--bg-secondary)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border)] sticky top-0 z-10">
            <tr>
              <th className="py-3 px-3 w-28">Date</th>
              <th className="py-3 px-3 w-28">Type</th>
              <th className="py-3 px-4 min-w-[240px]">Description / Line Items</th>
              <th className="py-3 px-3 text-right w-28">Debit (Given)</th>
              <th className="py-3 px-3 text-right w-32">Credit (Return/Pay)</th>
              <th className="py-3 px-3 text-right w-36">Running Balance</th>
              <th className="py-3 px-3 text-center w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[var(--text-muted)]">
                  <div className="w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading chronological ledger...
                </td>
              </tr>
            ) : filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[var(--text-muted)]">
                  <Package size={32} className="mx-auto mb-2 opacity-30" />
                  No ledger transactions found
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => {
                const isExpanded = expandedRows.has(entry.id);
                const hasItems = entry.items && entry.items.length > 0;

                // Debit amount logic: SALE or positive ADJUSTMENT
                const isDebit = entry.type === "SALE" || (entry.type === "ADJUSTMENT" && entry.amount > 0);
                // Credit amount logic: RETURN, PAYMENT, or negative ADJUSTMENT
                const isCredit =
                  entry.type === "RETURN" ||
                  entry.type === "PAYMENT" ||
                  (entry.type === "ADJUSTMENT" && entry.amount < 0);

                const debitAmount = isDebit ? Math.abs(entry.amount) : null;
                const creditAmount = isCredit ? Math.abs(entry.amount) : null;

                const balance = entry.runningBalance;
                const balanceSuffix = balance > 0 ? "Dr" : balance < 0 ? "Cr" : "Nil";
                const balanceColor =
                  balance > 0
                    ? "text-[var(--red)]"
                    : balance < 0
                    ? "text-[var(--green-bright)]"
                    : "text-[var(--text-muted)]";

                return (
                  <tr key={entry.id} className="group hover:bg-white/[0.02] transition-colors">
                    {/* Date */}
                    <td className="py-3 px-3 text-[var(--text-secondary)] whitespace-nowrap align-top font-medium">
                      {formatDate(entry.date)}
                    </td>

                    {/* Type Badge */}
                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getTypeBadge(
                          entry.type
                        )}`}
                      >
                        {entry.type}
                      </span>
                    </td>

                    {/* Description / Line Items */}
                    <td className="py-3 px-4 align-top">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.description && (
                            <span className="font-medium text-[var(--text-primary)] leading-snug">
                              {entry.description}
                            </span>
                          )}

                          {/* Edited indicator badge */}
                          {entry.updatedAt &&
                            entry.createdAt &&
                            new Date(entry.updatedAt).getTime() - new Date(entry.createdAt).getTime() > 2000 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTxForHistory(entry);
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/25 transition cursor-pointer"
                                title="Click to view change history for this entry"
                              >
                                <Clock size={10} />
                                <span>Edited</span>
                              </button>
                            )}
                        </div>

                        {/* Payment method & Reference badges */}
                        {(entry.paymentMethod || entry.reference) && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                            {entry.paymentMethod && (
                              <span className="font-semibold text-[var(--text-secondary)]">
                                {entry.paymentMethod.replace("_", " ")}
                              </span>
                            )}
                            {entry.paymentMethod && entry.reference && <span>•</span>}
                            {entry.reference && <span>Ref: {entry.reference}</span>}
                          </div>
                        )}

                        {/* Line items preview & expand button */}
                        {hasItems && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => toggleRowExpansion(entry.id)}
                              className="inline-flex items-center gap-1 text-[11px] text-[var(--gold)] hover:text-[var(--gold-light)] font-semibold transition"
                            >
                              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              <span>
                                {entry.items.length} {entry.items.length === 1 ? "item" : "items"}:
                              </span>
                              <span className="text-[var(--text-secondary)] font-normal truncate max-w-[200px]">
                                {entry.items.map((it) => it.productName).join(", ")}
                              </span>
                            </button>

                            {/* Line items expansion accordion sub-table */}
                            {isExpanded && (
                              <div className="mt-2.5 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] space-y-1.5 animate-in fade-in duration-150">
                                <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] pb-1 mb-1.5 flex justify-between">
                                  <span>Particulars / Item</span>
                                  <div className="flex gap-6">
                                    <span>Qty</span>
                                    <span>Rate</span>
                                    <span>Total</span>
                                  </div>
                                </div>
                                {entry.items.map((it, idx) => (
                                  <div
                                    key={it.id || idx}
                                    className="flex justify-between items-center text-xs py-0.5"
                                  >
                                    <span className="text-[var(--text-primary)] font-medium">
                                      {it.productName}
                                    </span>
                                    <div className="flex items-center gap-6 font-mono text-[var(--text-secondary)]">
                                      <span>
                                        {it.quantity} {it.unit || "PCS"}
                                      </span>
                                      <span>{formatINR(it.unitPrice)}</span>
                                      <span className="font-semibold text-[var(--text-primary)]">
                                        {formatINR(it.amount)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {entry.notes && (
                          <p className="text-[11px] text-[var(--text-muted)] italic">{entry.notes}</p>
                        )}
                      </div>
                    </td>

                    {/* Debit (Given) */}
                    <td className="py-3 px-3 text-right align-top font-mono font-medium text-[var(--text-primary)]">
                      {debitAmount != null ? formatINR(debitAmount) : "—"}
                    </td>

                    {/* Credit (Return/Pay) */}
                    <td className="py-3 px-3 text-right align-top font-mono font-medium text-[var(--green-bright)]">
                      {creditAmount != null ? formatINR(creditAmount) : "—"}
                    </td>

                    {/* Running Balance */}
                    <td className="py-3 px-3 text-right align-top whitespace-nowrap font-mono font-bold">
                      <span className={balanceColor}>
                        {formatINR(Math.abs(balance))} {balanceSuffix}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-center align-top whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditClick(entry)}
                          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--gold)] hover:bg-[var(--gold)]/10 transition"
                          title="Edit transaction"
                          aria-label="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(entry)}
                          className="p-1.5 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 transition"
                          title="Delete transaction"
                          aria-label="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      )}

      {/* Internal Modals when standalone */}
      {editingTransaction && (
        <EditTransactionModal
          open={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          customerId={customerId}
          customerName={customerName}
          transaction={editingTransaction}
        />
      )}

      {deletingTransaction && (
        <DeleteTransactionDialog
          open={!!deletingTransaction}
          onClose={() => setDeletingTransaction(null)}
          customerId={customerId}
          customerName={customerName}
          transaction={deletingTransaction}
        />
      )}

      {/* Audit Log & History Modals */}
      {selectedTxForHistory && (
        <TransactionHistoryModal
          open={!!selectedTxForHistory}
          onClose={() => setSelectedTxForHistory(null)}
          customerId={customerId}
          transaction={selectedTxForHistory}
        />
      )}

      {showHistoryDrawer && (
        <CustomerLedgerHistoryDrawer
          open={showHistoryDrawer}
          onClose={() => setShowHistoryDrawer(false)}
          customerId={customerId}
          customerName={customerName}
        />
      )}
    </div>
  );
}
