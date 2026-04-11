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

export function formatINR(n: number): string {
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

Your invoice *${opts.invoiceNumber}* for *${formatINR(opts.invoiceAmount)}* is ready.

View invoice: ${invoiceUrl}

Thank you for your business!
— Sent via DistroAI`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Safely extract the primary image URL from a string that might be a JSON array of URLs.
 */
export function getPrimaryImageUrl(imageUrl: unknown): string {
    if (!imageUrl || typeof imageUrl !== "string") return "";
    try {
        const parsed = JSON.parse(imageUrl);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : "";
    } catch {
        return imageUrl;
    }
}

export const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi",
    "Jammu and Kashmir", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Lakshadweep", "Puducherry", "Andaman and Nicobar Islands", "Ladakh"
];

export const STATE_CODES: Record<string, string> = {
    '01': 'Jammu and Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '25': 'Daman and Diu',
    '26': 'Dadra and Nagar Haveli and Daman and Diu',
    '27': 'Maharashtra',
    '28': 'Andhra Pradesh',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
    '38': 'Ladakh',
};

export function parseGstin(gstin: string): { valid: boolean; stateCode?: string; stateName?: string; pan?: string } {
    if (!gstin || gstin.length !== 15) return { valid: false };

    const stateCode = gstin.substring(0, 2);
    const pan = gstin.substring(2, 12);
    const stateName = STATE_CODES[stateCode];

    return { valid: !!stateName, stateCode, stateName, pan };
}

/**
 * Generic utility to export an array of objects to a CSV file.
 * @param filename Name of the exported file (without .csv extension)
 * @param data Array of objects (keys become headers)
 */
export function exportToCSV<T extends Record<string, any>>(filename: string, data: T[]) {
    if (!data || !data.length) return;

    // Extract headers (keys of the first object)
    const headers = Object.keys(data[0]);

    // Build CSV string
    const csvContent = [
        headers.join(","), // Header row
        ...data.map((row) =>
            headers
                .map((header) => {
                    let cell = row[header] === null || row[header] === undefined ? "" : String(row[header]);
                    // Escape quotes and handle commas
                    if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
                        cell = `"${cell.replace(/"/g, '""')}"`;
                    }
                    return cell;
                })
                .join(",")
        ),
    ].join("\n");

    // Create a Blob and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
