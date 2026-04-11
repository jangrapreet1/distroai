// Shared status badge CSS class maps for data tables
// ─────────────────────────────────────────────────────

/** Order status → CSS class */
export const ORDER_STATUS_CLASS: Record<string, string> = {
    DRAFT: "badge-draft",
    CONFIRMED: "badge-confirmed",
    PACKED: "badge-packed",
    DISPATCHED: "badge-dispatched",
    DELIVERED: "badge-delivered",
    CANCELLED: "badge-cancelled",
    RETURNED: "badge-cancelled",
};

/** Invoice status → CSS class */
export const INVOICE_STATUS_CLASS: Record<string, string> = {
    DRAFT: "badge-draft",
    SENT: "badge-sent",
    PARTIAL: "badge-partial",
    PAID: "badge-paid",
    OVERDUE: "badge-overdue",
    CANCELLED: "badge-cancelled",
};

/** Purchase Order status → CSS class */
export const PO_STATUS_CLASS: Record<string, string> = {
    DRAFT: "badge-draft",
    SENT: "badge-sent",
    PARTIAL: "badge-partial",
    RECEIVED: "badge-delivered",
    CANCELLED: "badge-cancelled",
};

/** Payment methods */
export const PAYMENT_METHODS = ["CASH", "UPI", "CHEQUE", "BANK_TRANSFER", "CREDIT"] as const;
