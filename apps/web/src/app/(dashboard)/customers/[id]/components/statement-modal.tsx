"use client";

import { useState } from "react";
import { X, Download, Printer, Calendar, RefreshCw, FileText } from "lucide-react";
import { useCustomerStatement } from "@/hooks/api-hooks";
import { downloadCustomerStatementPdf, printCustomerStatement } from "@/lib/statement-actions";
import { formatINR, formatDate } from "@/lib/utils";

interface StatementModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
}

type DatePreset = "ALL_TIME" | "THIS_MONTH" | "LAST_30_DAYS" | "CURRENT_FY" | "CUSTOM";

export function StatementModal({ open, isOpen, onClose, customerId, customerName }: StatementModalProps) {
  const isVisible = open ?? isOpen ?? false;
  const [preset, setPreset] = useState<DatePreset>("ALL_TIME");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Compute preset dates
  const handlePresetChange = (selected: DatePreset) => {
    setPreset(selected);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    if (selected === "ALL_TIME") {
      setStartDate("");
      setEndDate("");
    } else if (selected === "THIS_MONTH") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(today);
    } else if (selected === "LAST_30_DAYS") {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setStartDate(past30);
      setEndDate(today);
    } else if (selected === "CURRENT_FY") {
      // Indian Financial Year: April 1 to March 31
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed, 3 = April
      const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
      setStartDate(`${fyStartYear}-04-01`);
      setEndDate(`${fyStartYear + 1}-03-31`);
    }
  };

  const queryParams = {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const statementResult = useCustomerStatement(isVisible ? customerId : "", queryParams);
  const { data: statement, isLoading = false, isFetching = false, refetch = () => {} } = statementResult || {};

  if (!isVisible) return null;

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadCustomerStatementPdf({ customerId, customerName, params: queryParams });
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      await printCustomerStatement({ customerId, params: queryParams });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center border border-[var(--gold)]/20 text-[var(--gold)]">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                Account Statement & RTK Preview
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Customer: <span className="font-semibold text-[var(--text-primary)]">{customerName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 rounded-full transition"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-card)] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1">
              <Calendar size={14} /> Period:
            </span>
            {(["ALL_TIME", "THIS_MONTH", "LAST_30_DAYS", "CURRENT_FY", "CUSTOM"] as DatePreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePresetChange(p)}
                className={`px-3 py-1 text-xs font-medium rounded-md border transition ${
                  preset === p
                    ? "bg-[var(--gold)]/15 border-[var(--gold)]/40 text-[var(--gold)] font-bold"
                    : "bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                }`}
              >
                {p === "ALL_TIME"
                  ? "All Time"
                  : p === "THIS_MONTH"
                  ? "This Month"
                  : p === "LAST_30_DAYS"
                  ? "Last 30 Days"
                  : p === "CURRENT_FY"
                  ? "Current FY"
                  : "Custom"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPreset("CUSTOM");
              }}
              className="px-2.5 py-1 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none"
              placeholder="Start Date"
            />
            <span className="text-xs text-[var(--text-muted)]">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPreset("CUSTOM");
              }}
              className="px-2.5 py-1 text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] outline-none"
              placeholder="End Date"
            />
            <button
              type="button"
              onClick={() => refetch()}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--gold)] rounded transition"
              title="Refresh statement data"
            >
              <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Statement Preview Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-secondary)]/30">
          {isLoading ? (
            <div className="p-16 text-center">
              <div className="w-8 h-8 border-4 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-[var(--text-muted)]">Compiling RTK statement preview...</p>
            </div>
          ) : !statement ? (
            <div className="p-16 text-center text-[var(--text-muted)]">Failed to load statement data</div>
          ) : (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-6 shadow-sm space-y-6 max-w-4xl mx-auto">
              {/* Document Header */}
              <div className="text-center border-b border-[var(--border)] pb-4">
                <h1 className="text-xl font-bold tracking-wide uppercase text-[var(--text-primary)]" style={{ fontFamily: "var(--font-playfair)" }}>
                  {statement.organization?.name || "DistroAI"}
                </h1>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {[statement.organization?.address, statement.organization?.city, statement.organization?.state].filter(Boolean).join(", ")}
                  {statement.organization?.gstin ? ` | GSTIN: ${statement.organization.gstin}` : ""}
                </p>
                <div className="mt-3 inline-block px-4 py-1 rounded bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-xs font-bold uppercase tracking-widest text-[var(--gold)]">
                  RTK – {(statement.customer?.name || customerName).toUpperCase()} ACCOUNT SUMMARY
                </div>
                <div className="flex justify-between items-center text-xs text-[var(--text-muted)] mt-4 px-2">
                  <div>Customer: <strong className="text-[var(--text-primary)]">{statement.customer?.name || customerName}</strong></div>
                  <div>Date: <strong className="text-[var(--text-primary)]">{formatDate(statement.statementDate)}</strong></div>
                </div>
              </div>

              {/* 5-Column Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[var(--bg-secondary)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-y border-[var(--border)]">
                    <tr>
                      <th className="py-2.5 px-3 w-24">Date</th>
                      <th className="py-2.5 px-3">Goods Given to {statement.customer?.name || customerName}</th>
                      <th className="py-2.5 px-3 text-right w-28">Amount</th>
                      <th className="py-2.5 px-3 text-right w-28">Returned</th>
                      <th className="py-2.5 px-3 text-right w-32">Payment Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {!statement.rows || statement.rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[var(--text-muted)]">
                          No transactions found for the selected period
                        </td>
                      </tr>
                    ) : (
                      statement.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[var(--text-primary)]/[0.02] transition-colors">
                          <td className="py-2.5 px-3 text-[var(--text-secondary)] whitespace-nowrap">{formatDate(row.date)}</td>
                          <td className="py-2.5 px-3 text-[var(--text-primary)] leading-relaxed">{row.particulars}</td>
                          <td className="py-2.5 px-3 text-right font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                            {row.goodsGivenAmount != null ? formatINR(row.goodsGivenAmount) : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-[var(--orange)]" style={{ fontFamily: "var(--font-mono)" }}>
                            {row.returnedAmount != null ? formatINR(row.returnedAmount) : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-[var(--green-bright)]" style={{ fontFamily: "var(--font-mono)" }}>
                            {row.paymentReceivedAmount != null ? formatINR(row.paymentReceivedAmount) : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Account Summary Box */}
              <div className="flex justify-end pt-2">
                <div className="w-full sm:w-80 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>TOTAL GOODS GIVEN:</span>
                    <span className="font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-mono)" }}>
                      {formatINR(statement.summary?.totalGoodsGiven ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>LESS: GOODS RETURNED:</span>
                    <span className="font-semibold text-[var(--orange)]" style={{ fontFamily: "var(--font-mono)" }}>
                      {formatINR(statement.summary?.totalGoodsReturned ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>LESS: PAYMENTS RECEIVED:</span>
                    <span className="font-semibold text-[var(--green-bright)]" style={{ fontFamily: "var(--font-mono)" }}>
                      {formatINR(statement.summary?.totalPaymentsReceived ?? 0)}
                    </span>
                  </div>
                  <div className="border-t border-[var(--border)] pt-2 mt-2 flex justify-between items-center text-sm font-bold">
                    <span className="text-[var(--gold)]">BALANCE:</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-base font-bold ${
                          (statement.summary?.netBalance ?? 0) > 0
                            ? "text-[var(--red)]"
                            : (statement.summary?.netBalance ?? 0) < 0
                            ? "text-[var(--green-bright)]"
                            : "text-[var(--text-primary)]"
                        }`}
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {formatINR(Math.abs(statement.summary?.netBalance ?? 0))}
                      </span>
                      {(statement.summary?.netBalance ?? 0) < 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-semibold bg-emerald-500/10 text-[var(--green-bright)] border border-emerald-500/20">
                          Cr
                        </span>
                      )}
                      {(statement.summary?.netBalance ?? 0) > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-semibold bg-red-500/10 text-[var(--red)] border border-red-500/20">
                          Dr
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded transition"
          >
            Close
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting || isLoading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-[var(--radius-md)] bg-[var(--text-primary)]/10 text-[var(--text-primary)] hover:bg-[var(--text-primary)]/20 transition disabled:opacity-50"
            >
              <Printer size={14} className={isPrinting ? "animate-pulse" : ""} />
              {isPrinting ? "Preparing..." : "Print"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading || isLoading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-[var(--radius-md)] bg-[var(--gold)] text-black hover:bg-[var(--gold-light)] shadow-[0_0_15px_rgba(251,191,36,0.2)] transition disabled:opacity-50"
            >
              <Download size={14} className={isDownloading ? "animate-bounce" : ""} />
              {isDownloading ? "Downloading..." : "Download PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
