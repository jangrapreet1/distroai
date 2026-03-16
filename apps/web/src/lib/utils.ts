import { format, formatDistanceToNow } from "date-fns";

export function formatDate(date: string | Date): string {
    return format(new Date(date), "dd MMM yyyy");
}

export function formatDateTime(date: string | Date): string {
    return format(new Date(date), "dd MMM yyyy, hh:mm a");
}

export function timeAgo(date: string | Date): string {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
}

export function formatINRShared(n: number): string {
    return "₹" + n.toLocaleString("en-IN");
}

/**
 * Build a wa.me click-to-chat link for sending an invoice to a customer.
 * Opens WhatsApp with a pre-filled message containing invoice details and a view link.
 */
export function buildWhatsAppInvoiceLink(opts: {
    customerPhone: string;
    customerName: string;
    invoiceNumber: string;
    invoiceAmount: number;
    invoiceId: string;
}): string {
    const cleanPhone = opts.customerPhone.replace(/[^0-9]/g, "");
    const invoiceUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/invoices/${opts.invoiceId}`;
    const message = `Hello ${opts.customerName},

Your invoice *${opts.invoiceNumber}* for *${formatINRShared(opts.invoiceAmount)}* is ready.

View invoice: ${invoiceUrl}

Thank you for your business!
— Sent via DistroAI`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
