"use client";

import { use, useState } from "react";
import {
  useCustomer,
  useCustomerCreditScore,
  useCustomerActivity,
  useCreateLocationRequest,
  useCustomerLedger,
} from "@/hooks/api-hooks";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Package,
  Send,
  MessageCircle,
  PackagePlus,
  Undo2,
  CheckCircle2,
  SlidersHorizontal,
  FileSpreadsheet,
  Printer,
  Download,
  BookOpen,
  Receipt,
  User,
} from "lucide-react";
import { formatDate, buildWhatsAppInvoiceLink, formatINR } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import dynamic from "next/dynamic";
import type { CustomerTransactionType } from "@/types/customer-transactions";
import { CustomerLedgerTable } from "./components/customer-ledger-table";
import { CreateTransactionModal } from "./components/create-transaction-modal";
import { StatementModal } from "./components/statement-modal";
import { downloadCustomerStatementPdf, printCustomerStatement } from "@/lib/statement-actions";

const CustomerMap = dynamic(() => import("@/components/ui/customer-map"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full bg-[var(--bg-secondary)] animate-pulse rounded-[var(--radius-lg)]" />
  ),
});

function PaymentScoreGauge({ score, band }: { score: number; band: string }) {
  const color =
    band === "GREEN"
      ? "var(--green-bright)"
      : band === "YELLOW"
      ? "var(--warning)"
      : band === "ORANGE"
      ? "var(--orange)"
      : "var(--red)";
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center group">
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        className="transition-transform duration-500 group-hover:scale-105"
        style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
      >
        <circle cx="60" cy="60" r="45" fill="none" stroke="var(--border)" strokeWidth="10" className="opacity-50" />
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 60 60)"
          className="transition-all duration-1000 ease-out animate-pulse"
        />
        <text
          x="60"
          y="55"
          textAnchor="middle"
          fill={color}
          fontSize="28"
          fontWeight="bold"
          fontFamily="var(--font-mono)"
        >
          {score}
        </text>
        <text x="60" y="72" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontWeight="500">
          / 100
        </text>
      </svg>
      <span
        className="text-[10px] uppercase font-bold mt-2 px-3 py-1 rounded-sm shadow-[inset_0_1px_rgba(255,255,255,0.1)] tracking-widest"
        style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30` }}
      >
        {band}
      </span>
    </div>
  );
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  netAmount: number;
  invoiceId?: string;
}

interface RecentPayment {
  id: string;
  createdAt: string;
  paidAt?: string;
  method?: string;
  referenceNumber?: string;
  amount: number;
}

interface CustomerActivityItem {
  id: string;
  type: string;
  title?: string;
  createdAt: string;
  status: string;
  description?: string;
  amount?: number | null;
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = "then" in params ? use(params) : params;
  const id = resolvedParams.id || "";
  const { data: customerData, isLoading } = useCustomer(id);
  const { data: creditData } = useCustomerCreditScore(id);
  const { data: activityData, isLoading: activityLoading } = useCustomerActivity(id, 1, 20);
  const { data: ledgerData } = useCustomerLedger(id);

  const activities = activityData?.data ?? [];
  const customer = customerData?.customer;
  const stats = customerData?.stats;
  const recentOrders = customerData?.recentOrders ?? [];
  const recentPayments = customerData?.recentPayments ?? [];
  const paymentSummary = customerData?.paymentSummary;
  const creditScore = creditData?.data ?? creditData;
  const summary = ledgerData?.summary;

  const [activeTab, setActiveTab] = useState<"ledger" | "orders" | "profile">("ledger");

  // Modal controls
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<CustomerTransactionType>("SALE");
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);

  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const locationRequest = useCreateLocationRequest(id);
  const requestLocation = locationRequest?.mutate;

  if (isLoading)
    return (
      <div className="p-8 text-center">
        <div className="w-8 h-8 border-4 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  if (!customer) return <div className="p-8 text-center text-red-500">Customer not found</div>;

  const tierColors: Record<string, string> = {
    GOLD: "var(--gold)",
    SILVER: "var(--text-muted)",
    BRONZE: "var(--orange)",
  };

  const handleRequestLocation = () => {
    if (!customer?.phone) return;
    setIsRequestingLocation(true);
    requestLocation(undefined, {
      onSuccess: (data) => {
        const message = encodeURIComponent(
          `Hi ${customer.name}, to ensure your deliveries are always fast and accurate, please click this link to share your exact shop location: ${data.url}`
        );
        window.open(`https://wa.me/${customer.phone?.replace(/[^0-9]/g, "")}?text=${message}`, "_blank");
        setIsRequestingLocation(false);
      },
      onError: () => {
        setIsRequestingLocation(false);
      },
    });
  };

  const handleOpenCreateModal = (type: CustomerTransactionType) => {
    setCreateModalType(type);
    setIsCreateModalOpen(true);
  };

  // Determine current net balance and status styling
  const currentBalance = summary?.netBalance ?? customer.outstandingAmount ?? 0;
  const isDebit = currentBalance > 0;
  const isCredit = currentBalance < 0;

  const balanceColorClass = isDebit
    ? "text-[var(--red)]"
    : isCredit
    ? "text-[var(--green-bright)]"
    : "text-[var(--text-primary)]";

  const statusBadge = isDebit
    ? {
        label: "DEBIT OUTSTANDING (बकाया)",
        className: "bg-[var(--red)]/10 text-[var(--red)] border border-[var(--red)]/30",
        suffix: "Dr",
      }
    : isCredit
    ? {
        label: "ADVANCE CREDIT (जमा शेष)",
        className: "bg-[var(--green-bright)]/10 text-[var(--green-bright)] border border-[var(--green-bright)]/30",
        suffix: "Cr",
      }
    : {
        label: "SETTLED (हिसाब चुकता)",
        className: "bg-[var(--green-bright)]/10 text-[var(--green-bright)] border border-[var(--green-bright)]/30",
        suffix: "Nil",
      };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Communication Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/customers"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--gold)] transition"
          >
            <ArrowLeft size={16} /> Back to Customers
          </Link>
          <span className="text-[var(--text-muted)]">/</span>
          <h1
            className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-muted)]"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            {customer.name}
          </h1>
          <span
            className="px-2 py-0.5 text-[10px] font-bold rounded-sm border"
            style={{
              backgroundColor: `${tierColors[customer.tier] || "var(--gold)"}15`,
              color: tierColors[customer.tier] || "var(--gold)",
              borderColor: `${tierColors[customer.tier] || "var(--gold)"}30`,
            }}
          >
            {customer.tier}
          </span>
          <span className="px-2 py-0.5 bg-[var(--text-primary)]/10 text-[var(--text-secondary)] border border-[var(--text-primary)]/20 text-[10px] font-bold rounded-sm">
            {customer.type}
          </span>
        </div>

        {customer.phone && (
          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-md)] bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 text-[var(--whatsapp)] hover:bg-[var(--whatsapp)]/10 hover:border-[var(--whatsapp)]/50 transition"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
            <a
              href={`tel:${customer.phone}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-md)] bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 text-[var(--text-primary)] hover:bg-[var(--text-primary)]/10 transition"
            >
              <Phone size={14} /> Call
            </a>
            <button
              onClick={handleRequestLocation}
              disabled={isRequestingLocation}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-md)] bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 text-[var(--text-primary)] hover:border-[var(--gold)]/50 transition disabled:opacity-50"
            >
              <MapPin size={14} className={isRequestingLocation ? "text-[var(--text-muted)] animate-pulse" : "text-[var(--gold)]"} />
              {isRequestingLocation ? "Generating..." : "Location"}
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* PROMINENT CURRENT BALANCE HERO CARD & STATEMENT ACTIONS  */}
      {/* ======================================================== */}
      <div
        className={`relative overflow-hidden rounded-[var(--radius-lg)] border p-6 shadow-xl transition-all ${
          isDebit
            ? "border-[var(--red)]/30 bg-gradient-to-br from-red-500/[0.05] via-transparent to-transparent shadow-[0_0_35px_rgba(239,68,68,0.08)]"
            : isCredit
            ? "border-[var(--green-bright)]/30 bg-gradient-to-br from-emerald-500/[0.05] via-transparent to-transparent shadow-[0_0_35px_rgba(92,196,136,0.08)]"
            : "border-[var(--border)] bg-white/[0.02]"
        }`}
      >
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)]">
                Current Balance (वर्तमान शेष)
              </span>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
            </div>
            <div className={`font-mono text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight ${balanceColorClass}`}>
              Current Balance: {formatINR(Math.abs(currentBalance))}{" "}
              <span className="text-lg sm:text-xl font-bold opacity-80">{statusBadge.suffix}</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1.5">
              {isDebit
                ? `Customer owes ${formatINR(currentBalance)} to you`
                : isCredit
                ? `Customer has an advance credit balance of ${formatINR(Math.abs(currentBalance))}`
                : "All accounts are currently settled with zero pending balance"}
            </p>
          </div>

          {/* Statement Action Button Deck */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsStatementModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[var(--radius-md)] border border-[var(--border)] bg-white/5 text-[var(--text-primary)] hover:border-[var(--gold)]/50 hover:text-[var(--gold)] transition shadow-sm"
            >
              <FileSpreadsheet size={15} /> Generate Statement
            </button>
            <button
              type="button"
              onClick={() => printCustomerStatement({ customerId: customer.id })}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[var(--radius-md)] border border-[var(--border)] bg-white/5 text-[var(--text-primary)] hover:border-[var(--gold)]/50 hover:text-[var(--gold)] transition shadow-sm"
            >
              <Printer size={15} /> Print
            </button>
            <button
              type="button"
              onClick={() => downloadCustomerStatementPdf({ customerId: customer.id, customerName: customer.name })}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-[var(--radius-md)] bg-[var(--gold)] text-black hover:bg-[var(--gold-light)] shadow-[0_0_15px_rgba(251,191,36,0.25)] hover:-translate-y-0.5 transition"
            >
              <Download size={15} /> Download PDF
            </button>
          </div>
        </div>

        {/* Sub-stat Chips: Total Goods Given, Goods Returned, Payments Received, Adjustments */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[var(--border)]">
          <div className="p-3 rounded-lg bg-[var(--bg-secondary)]/50 border border-white/5">
            <div className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wider">
              Total Goods Given
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-[var(--text-primary)] mt-0.5">
              {formatINR(summary?.totalGoodsGiven ?? 0)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-secondary)]/50 border border-white/5">
            <div className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wider">
              Goods Returned
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-[var(--orange)] mt-0.5">
              {formatINR(summary?.totalGoodsReturned ?? 0)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-secondary)]/50 border border-white/5">
            <div className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wider">
              Payments Received
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-[var(--green-bright)] mt-0.5">
              {formatINR(summary?.totalPaymentsReceived ?? 0)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-secondary)]/50 border border-white/5">
            <div className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wider">
              Net Adjustments
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-[#A78BFA] mt-0.5">
              {formatINR(summary?.totalAdjustments ?? 0)}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* QUICK ACTION BUTTONS BAR                                 */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => handleOpenCreateModal("SALE")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-[var(--radius-md)] bg-[var(--gold)] text-black hover:bg-[var(--gold-light)] shadow-[0_0_15px_rgba(201,168,76,0.25)] hover:-translate-y-0.5 transition"
        >
          <PackagePlus size={15} /> + Goods Given
        </button>
        <button
          type="button"
          onClick={() => handleOpenCreateModal("RETURN")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-[var(--radius-md)] bg-[var(--orange)]/15 text-[var(--orange)] border border-[var(--orange)]/30 hover:bg-[var(--orange)]/25 hover:-translate-y-0.5 transition"
        >
          <Undo2 size={15} /> + Goods Returned
        </button>
        <button
          type="button"
          onClick={() => handleOpenCreateModal("PAYMENT")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-[var(--radius-md)] bg-[var(--green-bright)]/15 text-[var(--green-bright)] border border-[var(--green-bright)]/30 hover:bg-[var(--green-bright)]/25 hover:-translate-y-0.5 transition"
        >
          <CheckCircle2 size={15} /> + Payment Received
        </button>
        <button
          type="button"
          onClick={() => handleOpenCreateModal("ADJUSTMENT")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-[var(--radius-md)] bg-white/5 text-[var(--text-primary)] border border-white/10 hover:border-[var(--purple)]/50 hover:bg-[var(--purple)]/10 hover:-translate-y-0.5 transition"
        >
          <SlidersHorizontal size={15} /> + Adjustment
        </button>
      </div>

      {/* ======================================================== */}
      {/* NAVIGATION TABS & MAIN CONTENT                           */}
      {/* ======================================================== */}
      <div className="flex border-b border-[var(--border)] gap-6 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("ledger")}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === "ledger"
              ? "border-[var(--gold)] text-[var(--gold)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <BookOpen size={16} /> Account Ledger & Statement
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === "orders"
              ? "border-[var(--gold)] text-[var(--gold)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <Receipt size={16} /> Orders & Invoices ({recentOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === "profile"
              ? "border-[var(--gold)] text-[var(--gold)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <User size={16} /> Profile & Analytics
        </button>
      </div>

      {/* TAB 1: CHRONOLOGICAL LEDGER TABLE */}
      {activeTab === "ledger" && (
        <div className="space-y-6">
          <CustomerLedgerTable customerId={customer.id} customerName={customer.name} />
        </div>
      )}

      {/* TAB 2: ORDERS & INVOICES */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          {/* Payment Ageing */}
          {paymentSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Current", amount: paymentSummary.current, color: "var(--green-bright)" },
                { label: "30+ Days", amount: paymentSummary.overdue30, color: "var(--warning)" },
                { label: "60+ Days", amount: paymentSummary.overdue60, color: "var(--orange)" },
                { label: "90+ Days", amount: paymentSummary.overdue90, color: "var(--red)" },
              ].map((a) => (
                <div
                  key={a.label}
                  className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] rounded-[var(--radius-md)] p-5 text-center group hover:-translate-y-1 hover:bg-white/[0.04] transition-all duration-300"
                >
                  <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: a.color }}>
                    {a.label}
                  </p>
                  <p
                    className="text-xl font-bold tracking-tight"
                    style={{ fontFamily: "var(--font-mono)", color: a.amount > 0 ? a.color : "var(--text-muted)" }}
                  >
                    {formatINR(a.amount ?? 0)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Recent Orders Table */}
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] rounded-[var(--radius-lg)] overflow-hidden">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-transparent to-white/[0.01]">
              <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-playfair)" }}>
                Recent Orders
              </h2>
              <Link
                href={`/orders/new?customer=${customer.id}`}
                className="px-4 py-2 bg-[var(--gold)] text-black text-xs font-bold rounded-md hover:bg-[var(--gold-light)] shadow-[0_0_15px_rgba(251,191,36,0.3)] hover:-translate-y-0.5 transition-all duration-300"
              >
                + New Order
              </Link>
            </div>
            <div className="p-2 space-y-1">
              <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 p-3 text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-white/5 mx-2">
                <div>Order #</div>
                <div>Date</div>
                <div className="text-right">Amount</div>
                <div className="text-center">Status</div>
                <div className="text-right w-20">Actions</div>
              </div>

              {recentOrders.length === 0 ? (
                <div className="p-10 text-center text-[var(--text-muted)] animate-in fade-in">
                  <Package size={40} className="mx-auto mb-3 opacity-20" />
                  <p>No orders yet</p>
                </div>
              ) : (
                recentOrders.map((order: RecentOrder) => (
                  <div
                    key={order.id}
                    className="group grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 p-3 mx-2 items-center rounded-lg border border-transparent hover:bg-[var(--text-primary)]/5 hover:border-[var(--text-primary)]/10 transition-all duration-300 cursor-default"
                  >
                    <div className="font-medium">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-[var(--gold)] hover:text-[var(--gold-light)] transition-colors"
                      >
                        {order.orderNumber}
                      </Link>
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                      {formatDate(order.createdAt)}
                    </div>
                    <div
                      className="text-sm text-right font-bold tracking-tight group-hover:text-[var(--green-bright)] transition-colors"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {formatINR(order.netAmount)}
                    </div>
                    <div className="text-center">
                      <span
                        className={`inline-block px-2.5 py-1 text-[10px] font-bold uppercase rounded-md tracking-widest border ${
                          order.status === "DELIVERED"
                            ? "bg-[var(--green-bright)]/10 text-[var(--green-bright)] border-[var(--green-bright)]/20"
                            : order.status === "CANCELLED"
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : order.status === "DRAFT"
                            ? "bg-[var(--text-primary)]/5 text-[var(--text-secondary)] border-[var(--text-primary)]/10"
                            : "bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/20"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="text-right w-20 flex justify-end">
                      {order.invoiceId && customer.phone && (
                        <a
                          href={buildWhatsAppInvoiceLink({
                            customerPhone: customer.phone,
                            customerName: customer.name,
                            invoiceNumber: order.orderNumber,
                            invoiceAmount: order.netAmount,
                            invoiceId: order.invoiceId,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--whatsapp)]/10 text-[var(--whatsapp)] hover:bg-[var(--whatsapp)] hover:text-black transition-all"
                          title="Send Invoice"
                        >
                          <Send size={14} className="ml-[-1px]" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Payments */}
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] rounded-[var(--radius-lg)] overflow-hidden">
            <div className="p-5 border-b border-white/5 bg-gradient-to-r from-transparent to-white/[0.01]">
              <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-playfair)" }}>
                Recent Payments
              </h2>
            </div>
            <div className="p-2 space-y-1">
              <div className="grid grid-cols-[1fr_1fr_1fr_1.5fr] gap-4 p-3 text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-white/5 mx-2">
                <div>Date</div>
                <div>Method</div>
                <div className="text-right">Amount</div>
                <div className="text-right">Reference</div>
              </div>
              {recentPayments.length === 0 ? (
                <div className="p-10 text-center text-[var(--text-muted)]">
                  <CreditCard size={40} className="mx-auto mb-3 opacity-20" />
                  <p>No payments recorded</p>
                </div>
              ) : (
                recentPayments.map((p: RecentPayment) => (
                  <div
                    key={p.id}
                    className="group grid grid-cols-[1fr_1fr_1fr_1.5fr] gap-4 p-3 mx-2 items-center rounded-lg border border-transparent hover:bg-[var(--text-primary)]/5 transition-all duration-300 cursor-default"
                  >
                    <div className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                      {formatDate(p.paidAt ?? p.createdAt)}
                    </div>
                    <div>
                      <span className="px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-widest bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20">
                        {p.method?.replace("_", " ")}
                      </span>
                    </div>
                    <div
                      className="text-sm text-right font-bold tracking-tight text-[var(--green-bright)]"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {formatINR(p.amount ?? 0)}
                    </div>
                    <div className="text-sm text-right text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] truncate transition-colors">
                      {p.referenceNumber ?? "—"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROFILE & ANALYTICS */}
      {activeTab === "profile" && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Customer Info Card */}
          <div className="w-full lg:w-1/3 space-y-6">
            <div className="relative overflow-hidden bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] rounded-[var(--radius-lg)] p-6">
              <div
                className="absolute top-0 right-0 w-64 h-64 opacity-20 pointer-events-none blur-[60px]"
                style={{
                  background: `radial-gradient(circle, ${tierColors[customer.tier] || "var(--gold)"} 0%, transparent 70%)`,
                }}
              />
              <div className="relative z-10 flex items-center justify-between mb-4">
                <h1
                  className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-muted)]"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  {customer.name}
                </h1>
                <div className="flex gap-2">
                  <span
                    className="px-2 py-0.5 text-[10px] font-bold rounded-sm border"
                    style={{
                      backgroundColor: `${tierColors[customer.tier] || "var(--gold)"}15`,
                      color: tierColors[customer.tier] || "var(--gold)",
                      borderColor: `${tierColors[customer.tier] || "var(--gold)"}30`,
                    }}
                  >
                    {customer.tier}
                  </span>
                  <span className="px-2 py-0.5 bg-[var(--text-primary)]/10 text-[var(--text-secondary)] border border-[var(--text-primary)]/20 text-[10px] font-bold rounded-sm">
                    {customer.type}
                  </span>
                </div>
              </div>
              <div className="relative z-10 space-y-3">
                {customer.phone && (
                  <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-default">
                    <Phone size={16} className="text-[var(--gold)]/70" />
                    {customer.phone}
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-default">
                    <Mail size={16} className="text-[var(--gold)]/70" />
                    {customer.email}
                  </div>
                )}
                {(customer.city || customer.state) && (
                  <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-default">
                    <MapPin size={16} className="text-[var(--gold)]/70" />
                    {customer.city}
                    {customer.state ? `, ${customer.state}` : ""}
                  </div>
                )}
                {customer.gstNumber && (
                  <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-default">
                    <ShieldCheck size={16} className="text-[var(--gold)]/70" />
                    GSTIN: {customer.gstNumber}
                  </div>
                )}
              </div>
            </div>

            {/* Payment Score Card */}
            {creditScore && (
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-lg rounded-[var(--radius-lg)] p-6">
                <h3 className="text-[10px] tracking-widest text-[var(--text-muted)] uppercase mb-4 font-bold">
                  Payment Score
                </h3>
                <PaymentScoreGauge
                  score={creditScore.score ?? customer.paymentScore ?? 0}
                  band={creditScore.band ?? "GREEN"}
                />
                <p className="text-xs text-[var(--text-muted)] mt-5 text-center leading-relaxed px-2">
                  {creditScore.recommendation}
                </p>
              </div>
            )}

            {/* Financial Snapshot */}
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-lg rounded-[var(--radius-lg)] p-6">
              <h3 className="text-[10px] tracking-widest text-[var(--text-muted)] uppercase mb-4 font-bold">
                Financial Snapshot
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center group">
                  <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition flex items-center gap-2">
                    <AlertTriangle size={14} className="text-[var(--red)]/70" /> Outstanding
                  </span>
                  <span
                    className="text-lg font-bold text-[var(--red)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {formatINR(customer.outstandingAmount ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center group">
                  <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition flex items-center gap-2">
                    <CreditCard size={14} className="text-[var(--gold)]/70" /> Credit Limit
                  </span>
                  <span className="text-sm font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                    {formatINR(customer.creditLimit ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center group">
                  <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition flex items-center gap-2">
                    <Clock size={14} className="text-[var(--gold)]/70" /> Credit Days
                  </span>
                  <span className="text-sm font-medium">{customer.creditDays ?? 0} days</span>
                </div>
                <div className="border-t border-white/5 pt-3 mt-3">
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition flex items-center gap-2">
                      <TrendingUp size={14} className="text-[var(--green-bright)]/70" /> Lifetime Revenue
                    </span>
                    <span
                      className="text-sm font-bold text-[var(--green-bright)]"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {formatINR(stats?.totalRevenue ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2 group">
                    <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition">
                      Total Orders
                    </span>
                    <span className="text-sm font-medium">{stats?.totalOrders ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 group">
                    <span className="text-sm text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition">
                      Avg Order Value
                    </span>
                    <span className="text-sm font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                      {formatINR(stats?.avgOrderValue ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* GPS Location Map */}
            {customer.latitude && customer.longitude && (
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-lg rounded-[var(--radius-lg)] p-6">
                <h3 className="text-[10px] tracking-widest text-[var(--text-muted)] uppercase mb-4 font-bold flex items-center justify-between">
                  GPS Location
                  <span className="bg-[var(--green-bright)]/10 text-[var(--green-bright)] border border-[var(--green-bright)]/30 px-2 py-0.5 rounded-sm flex items-center gap-1">
                    <MapPin size={10} /> Verified
                  </span>
                </h3>
                <CustomerMap latitude={customer.latitude} longitude={customer.longitude} customerName={customer.name} />
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="w-full lg:w-2/3">
            <div className="bg-[var(--text-primary)]/5 backdrop-blur-xl border border-[var(--text-primary)]/10 shadow-[0_8px_32px_rgba(0,0,0,0.1)] rounded-[var(--radius-lg)] p-8 relative overflow-hidden">
              <h2
                className="font-semibold text-lg mb-8 flex items-center gap-3 relative z-10"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center border border-[var(--gold)]/20">
                  <Clock className="text-[var(--gold)]" size={16} />
                </div>
                Activity Timeline
              </h2>

              <div className="space-y-6 relative z-10 max-h-[600px] overflow-y-auto pr-2">
                {activityLoading ? (
                  <p className="text-sm text-[var(--text-muted)] animate-pulse">Loading activity trace...</p>
                ) : activities.length === 0 ? (
                  <div className="text-center py-10 text-[var(--text-muted)]">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
                      <Clock size={24} className="opacity-40" />
                    </div>
                    <p className="text-sm tracking-widest uppercase">No temporal traces found</p>
                  </div>
                ) : (
                  <div className="relative before:absolute before:inset-0 before:ml-[1.125rem] before:-translate-x-px before:h-full before:w-[2px] before:bg-gradient-to-b before:from-[var(--gold)] before:via-[var(--gold)]/20 before:to-transparent">
                    {activities.map((act: CustomerActivityItem) => {
                      const isOrder = act.type.includes("ORDER");
                      const isLocation = act.type === "LOCATION_SHARED";
                      const colorVar = isOrder
                        ? act.type === "ORDER_RETURNED"
                          ? "var(--orange)"
                          : "var(--gold)"
                        : isLocation
                        ? "var(--whatsapp)"
                        : "var(--green-bright)";
                      return (
                        <div key={act.id} className="group relative flex items-start gap-5 mb-8 last:mb-0">
                          <div
                            className="relative z-10 flex shrink-0 items-center justify-center w-9 h-9 rounded-full bg-[var(--bg-primary)] border-2 transition-transform duration-500 group-hover:scale-110"
                            style={{ borderColor: `${colorVar}40`, boxShadow: `0 0 15px ${colorVar}40` }}
                          >
                            {isOrder ? (
                              <Package size={14} style={{ color: colorVar }} />
                            ) : isLocation ? (
                              <MapPin size={14} style={{ color: colorVar }} />
                            ) : (
                              <CreditCard size={14} style={{ color: colorVar }} />
                            )}
                          </div>
                          <div className="flex-1 bg-[var(--bg-card)] rounded-[var(--radius-lg)] p-5 border border-[var(--border)] shadow-sm hover:bg-[var(--bg-card-hover)] transition-all duration-300">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                              <h4 className="font-semibold text-[var(--text-primary)] text-sm tracking-wide">
                                {act.title}
                              </h4>
                              <time className="text-[10px] uppercase tracking-widest text-[var(--gold)]/70 font-medium bg-[var(--gold)]/5 px-2 py-1 rounded border border-[var(--gold)]/10">
                                {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                              </time>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4">
                              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                {act.description}
                              </p>
                              {act.amount != null && act.amount > 0 ? (
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-[10px] font-bold px-2 py-1 rounded-sm bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 uppercase tracking-widest text-[var(--text-secondary)]">
                                    {act.status}
                                  </span>
                                  <span
                                    className="text-sm font-bold tracking-tight"
                                    style={{ fontFamily: "var(--font-mono)", color: colorVar }}
                                  >
                                    {act.type.includes("PAYMENT") ? "+" : ""}
                                    {formatINR(act.amount)}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className="text-[10px] font-bold px-2 py-1 rounded-sm bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 uppercase tracking-widest"
                                    style={{ color: colorVar }}
                                  >
                                    {act.status}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateTransactionModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        customerId={customer.id}
        customerName={customer.name}
        currentBalance={currentBalance}
        initialType={createModalType}
      />

      <StatementModal
        open={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        customerId={customer.id}
        customerName={customer.name}
      />
    </div>
  );
}
