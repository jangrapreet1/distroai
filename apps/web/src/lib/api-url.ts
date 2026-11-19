/**
 * Returns the base URL for API requests.
 * 
 * Safe for both browser and server:
 * - If running in a browser on a remote domain (e.g. distroai.in) and NEXT_PUBLIC_API_URL
 *   mistakenly contains "localhost" or "127.0.0.1", it strips it and returns "" (empty string)
 *   so that all requests are same-origin relative URLs (/api/v1/...).
 * - In local dev (window.location.hostname is localhost), it respects NEXT_PUBLIC_API_URL.
 */
export function getApiBaseUrl(): string {
    const raw = process.env.NEXT_PUBLIC_API_URL || "";
    if (typeof window !== "undefined") {
        const isLocalWindow = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        const isLocalEnv = raw.includes("localhost") || raw.includes("127.0.0.1");
        if (isLocalEnv && !isLocalWindow) {
            return "";
        }
    }
    return raw;
}
