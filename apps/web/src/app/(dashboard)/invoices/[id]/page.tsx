"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Send, Download, CreditCard, CheckCircle, X, Link as LinkIcon, Receipt } from "lucide-react";
import { useInvoice, useRecordPayment } from "@/hooks/api-hooks";
import { formatDate, buildWhatsAppInvoiceLink , formatINR } from "@/lib/utils";
import apiClient from "@/lib/api-client";
import toast from "react-hot-toast";


const statusClass: Record<string, string> = { DRAFT: "badge-draft", SENT: "badge-sent", PARTIAL: "badge-partial", PAID: "badge-paid", OVERDUE: "badge-overdue", CANCELLED: "badge-cancelled" };

const PAYMENT_METHODS = ["CASH", "UPI", "CHEQUE", "BANK_TRANSFER", "CREDIT"] as const;

function RecordPaymentModal({ open, onClose, invoiceId, customerId, maxAmount }: {
    open: boolean; onClose: () => void; invoiceId: string; customerId: string; maxAmount: number;
}) {
    const recordPayment = useRecordPayment();
    const [amount, setAmount] = useState(maxAmount);
    const [method, setMethod] = useState<string>("CASH");
    const [referenceNumber, setReferenceNumber] = useState("");
    const [notes, setNotes] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0) return;
        recordPayment.mutate({ invoiceId, customerId, amount, method, referenceNumber: referenceNumber || undefined, notes: notes || undefined }, {
            onSuccess: () => { onClose(); },
        });
    };

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
                    <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-playfair)" }}>Record Payment</h2>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Amount (₹)</span>
                        <input type="number" min={0.01} max={maxAmount} step={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} required className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">Max: {formatINR(maxAmount)}</p>
                    </label>
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Payment Method</span>
                        <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition">
                            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                        </select>
                    </label>
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Reference Number</span>
                        <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="UPI Ref / Cheque No." className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none transition" />
                    </label>
                    <label>
                        <span className="text-xs text-[var(--text-muted)] mb-1 block">Notes</span>
                        <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition" />
                    </label>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">Cancel</button>
                        <button type="submit" disabled={recordPayment.isPending} className="px-6 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--green-bright)] text-[var(--bg-primary)] hover:opacity-90 disabled:opacity-50 transition">
                            {recordPayment.isPending ? "Recording..." : "Record Payment"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function InvoiceDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const { data, isLoading, refetch } = useInvoice(id);
    const invoice = data?.data ?? data ?? {};
    const [showPayment, setShowPayment] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState("");

    const items = invoice.items ?? [];
    const payments = invoice.payments ?? [];
    const customer = invoice.customer ?? {};

    const handleGeneratePdf = async () => {
        setPdfLoading(true);
        try {
            // If a PDF URL already exists, download it directly
            if (invoice.pdfUrl) {
                const link = document.createElement("a");
                link.href = invoice.pdfUrl;
                link.setAttribute("download", `Invoice-${invoice.invoiceNumber}.pdf`);
                link.setAttribute("target", "_blank");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success("PDF Downloaded");
                setPdfLoading(false);
                return;
            }
            // Trigger generation
            await apiClient.post(`/api/v1/invoices/${id}/pdf`);
            // Poll for the PDF to be ready (max 20s)
            let attempts = 0;
            const maxAttempts = 10;
            const pollInterval = 2000;
            const poll = async (): Promise<void> => {
                attempts++;
                const refreshed = await apiClient.get(`/api/v1/invoices/${id}`);
                const inv = refreshed.data?.data ?? refreshed.data;
                if (inv?.pdfUrl) {
                    const link = document.createElement("a");
                    link.href = inv.pdfUrl;
                    link.setAttribute("download", `Invoice-${invoice.invoiceNumber}.pdf`);
                    link.setAttribute("target", "_blank");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast.success("PDF Downloaded");
                    refetch();
                } else if (attempts < maxAttempts) {
                    await new Promise(r => setTimeout(r, pollInterval));
                    return poll();
                } else {
                    toast.error("PDF generation is taking longer than expected. Please try again.");
                }
            };
            toast.loading("Generating PDF...", { id: "pdf-gen" });
            await poll();
            toast.dismiss("pdf-gen");
        } catch {
            toast.error("PDF generation failed");
        }
        setPdfLoading(false);
    };

    const handleSend = async (channel: string) => {
        setActionLoading(channel);
        try {
            await apiClient.post(`/api/v1/invoices/${id}/send`, { channels: [channel] });
            toast.success(`Invoice sent via ${channel}`);
        } catch {
            toast.error(`Failed to send via ${channel}`);
        }
        setActionLoading("");
    };

    const handleAction = async (actionDesc: string, url: string) => {
        setActionLoading(actionDesc);
        try {
            await apiClient.post(url);
            toast.success(`${actionDesc} successful`);
            refetch();
        } catch {
            toast.error(`${actionDesc} failed`);
        }
        setActionLoading("");
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto space-y-4">
                <div className="skeleton h-8 w-48 rounded" />
                <div className="skeleton h-64 rounded-[var(--radius-md)]" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div className="flex items-start lg:items-center gap-3">
                    <Link href="/invoices" className="p-2 rounded-lg hover:bg-[var(--bg-card)] transition mt-0.5 lg:mt-0">
                        <ArrowLeft size={18} className="text-[var(--text-muted)]" />
                    </Link>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold break-words" style={{ fontFamily: "var(--font-playfair)" }}>
                            {invoice.invoiceNumber ?? "Invoice"}
                        </h1>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${statusClass[invoice.status as string] ?? "badge-draft"}`}>{invoice.status as string}</span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={handleGeneratePdf} disabled={pdfLoading} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition disabled:opacity-50">
                        <Download size={14} /> {pdfLoading ? "..." : "PDF"}
                    </button>
                    {!invoice.eInvoiceIrn && (
                        <button onClick={() => handleAction("Generate E-Invoice", `/api/v1/invoices/${id}/e-invoice`)} disabled={!!actionLoading} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition disabled:opacity-50">
                            <Receipt size={14} /> {actionLoading === "Generate E-Invoice" ? "..." : "E-Invoice"}
                        </button>
                    )}
                    <button onClick={() => handleAction("Create Payment Link", `/api/v1/invoices/${id}/payment-link`)} disabled={!!actionLoading} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--purple)] hover:bg-[var(--bg-card)] transition disabled:opacity-50">
                        <LinkIcon size={14} /> {actionLoading === "Create Payment Link" ? "..." : "Payment Link"}
                    </button>
                    {invoice.customer?.phone && (
                        <a href={buildWhatsAppInvoiceLink({
                            customerPhone: invoice.customer.phone,
                            customerName: invoice.customer.name ?? "Customer",
                            invoiceNumber: invoice.invoiceNumber,
                            invoiceAmount: invoice.totalAmount,
                            invoiceId: id,
                        })} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--whatsapp)] hover:bg-[var(--bg-card)] transition">
                            <Send size={14} /> WhatsApp
                        </a>
                    )}
                    {invoice.customer?.email && (
                        <button onClick={() => handleSend("email")} disabled={!!actionLoading} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition disabled:opacity-50">
                            <Send size={14} /> {actionLoading === "email" ? "..." : "Email"}
                        </button>
                    )}
                    {((invoice.balanceAmount as number) ?? 0) > 0 && (
                        <button onClick={() => setShowPayment(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--green-bright)] text-[var(--bg-primary)] hover:opacity-90 transition">
                            <CreditCard size={14} /> Record Payment
                        </button>
                    )}
                </div>
            </div>

            {/* Invoice Info */}
            <div className="grid lg:grid-cols-3 gap-4 mb-6">
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                    <h3 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">Customer</h3>
                    <p className="font-semibold">{customer.name ?? "—"}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{customer.phone ?? ""}</p>
                    {customer.gstNumber && <p className="text-xs text-[var(--text-muted)] mt-1">GST: {customer.gstNumber}</p>}
                </div>
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                    <h3 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">Dates</h3>
                    <div className="space-y-1">
                        <p className="text-sm"><span className="text-[var(--text-muted)]">Invoice:</span> {formatDate(invoice.invoiceDate)}</p>
                        <p className="text-sm"><span className="text-[var(--text-muted)]">Due:</span> {formatDate(invoice.dueDate)}</p>
                    </div>
                </div>
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                    <h3 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">Amounts</h3>
                    <div className="space-y-1">
                        <p className="text-sm"><span className="text-[var(--text-muted)]">Total:</span> <span style={{ fontFamily: "var(--font-mono)" }}>{formatINR((invoice.totalAmount as number) ?? 0)}</span></p>
                        <p className="text-sm"><span className="text-[var(--text-muted)]">Paid:</span> <span className="text-[var(--green-bright)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR((invoice.paidAmount as number) ?? 0)}</span></p>
                        <p className="text-sm font-semibold"><span className="text-[var(--text-muted)]">Balance:</span> <span style={{ fontFamily: "var(--font-mono)", color: ((invoice.balanceAmount as number) ?? 0) > 0 ? "var(--orange)" : "var(--green-bright)" }}>{formatINR((invoice.balanceAmount as number) ?? 0)}</span></p>
                    </div>
                </div>
            </div>

            {/* Line Items */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] mb-6 overflow-x-auto">
                <div className="p-5 border-b border-[var(--border)]">
                    <h3 className="font-semibold">Line Items</h3>
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                            <th className="text-left p-4">Product</th>
                            <th className="text-center p-4">Qty</th>
                            <th className="text-right p-4">Price</th>
                            <th className="text-right p-4">Tax</th>
                            <th className="text-right p-4">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(Array.isArray(items) ? items : []).map((item: Record<string, unknown>, i: number) => {
                            const taxAmt = ((item.cgstAmount as number) ?? 0) + ((item.sgstAmount as number) ?? 0) + ((item.igstAmount as number) ?? 0);
                            return (
                                <tr key={i} className="border-b border-[var(--border)]">
                                    <td className="p-4">
                                        <p className="font-medium">{String((item.product as Record<string, unknown>)?.name ?? item.productId ?? "")}</p>
                                        {((item.product as Record<string, unknown>)?.sku as string) && <p className="text-xs text-[var(--text-muted)]">SKU: {String((item.product as Record<string, unknown>).sku)}</p>}
                                    </td>
                                    <td className="p-4 text-center" style={{ fontFamily: "var(--font-mono)" }}>{item.quantity as number} {item.unit as string}</td>
                                    <td className="p-4 text-right" style={{ fontFamily: "var(--font-mono)" }}>
                                        {formatINR((item.price as number) ?? 0)}
                                        {((item.discount as number) ?? 0) > 0 && <span className="block text-[10px] text-[var(--green-bright)]">- {formatINR(item.discount as number)}</span>}
                                    </td>
                                    <td className="p-4 text-right text-[var(--text-muted)]" style={{ fontFamily: "var(--font-mono)" }}>
                                        {formatINR(taxAmt)}
                                        <span className="text-[10px] ml-1">({(item.gstRate as number) ?? 0}%)</span>
                                    </td>
                                    <td className="p-4 text-right font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{formatINR((item.totalAmount as number) ?? 0)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {/* Totals */}
                <div className="p-5 border-t border-[var(--border)]">
                    <div className="flex justify-end">
                        <div className="space-y-1 text-sm w-64">
                            <div className="flex justify-between"><span className="text-[var(--text-muted)]">Subtotal</span><span style={{ fontFamily: "var(--font-mono)" }}>{formatINR((invoice.subtotalAmount as number) ?? (invoice.totalAmount as number) ?? 0)}</span></div>
                            {((invoice.discountAmount as number) ?? 0) > 0 && (
                                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Discount</span><span className="text-[var(--green-bright)]" style={{ fontFamily: "var(--font-mono)" }}>-{formatINR((invoice.discountAmount as number) ?? 0)}</span></div>
                            )}
                            <div className="flex justify-between"><span className="text-[var(--text-muted)]">CGST</span><span style={{ fontFamily: "var(--font-mono)" }}>{formatINR((invoice.cgstAmount as number) ?? 0)}</span></div>
                            <div className="flex justify-between"><span className="text-[var(--text-muted)]">SGST</span><span style={{ fontFamily: "var(--font-mono)" }}>{formatINR((invoice.sgstAmount as number) ?? 0)}</span></div>
                            {((invoice.igstAmount as number) ?? 0) > 0 && (
                                <div className="flex justify-between"><span className="text-[var(--text-muted)]">IGST</span><span style={{ fontFamily: "var(--font-mono)" }}>{formatINR(invoice.igstAmount as number)}</span></div>
                            )}
                            <div className="flex justify-between pt-2 border-t border-[var(--border)] font-bold">
                                <span>Net Amount</span><span style={{ fontFamily: "var(--font-mono)" }}>{formatINR((invoice.totalAmount as number) ?? 0)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment History */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] overflow-x-auto">
                <div className="p-5 border-b border-[var(--border)]">
                    <h3 className="font-semibold">Payment History</h3>
                </div>
                {(Array.isArray(payments) ? payments : []).length === 0 ? (
                    <div className="p-8 text-center text-[var(--text-muted)]">No payments recorded yet</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                                <th className="text-left p-4">Date</th><th className="text-left p-4">Method</th><th className="text-right p-4">Amount</th><th className="text-left p-4">Reference</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(Array.isArray(payments) ? payments : []).map((p: Record<string, unknown>, i: number) => (
                                <tr key={i} className="border-b border-[var(--border)]">
                                    <td className="p-4 text-[var(--text-secondary)]">{formatDate(p.paidAt as string ?? p.createdAt as string)}</td>
                                    <td className="p-4"><span className="px-2 py-0.5 rounded-full text-xs bg-[var(--gold)]/15 text-[var(--gold)]">{(p.method as string)?.replace("_", " ")}</span></td>
                                    <td className="p-4 text-right text-[var(--green-bright)]" style={{ fontFamily: "var(--font-mono)" }}>{formatINR((p.amount as number) ?? 0)}</td>
                                    <td className="p-4 text-[var(--text-muted)]">{(p.referenceNumber as string) ?? "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {invoice.notes && (
                <div className="mt-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
                    <h3 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Notes</h3>
                    <p className="text-sm text-[var(--text-secondary)]">{invoice.notes as string}</p>
                </div>
            )}

            <RecordPaymentModal
                open={showPayment}
                onClose={() => { setShowPayment(false); refetch(); }}
                invoiceId={id}
                customerId={invoice.customerId as string ?? ""}
                maxAmount={(invoice.balanceAmount as number) ?? 0}
            />
        </div>
    );
}
