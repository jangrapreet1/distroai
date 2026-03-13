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
