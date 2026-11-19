import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/register", "/forgot-password", "/locate", "/p/"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // If user visits the root landing page and already has an active session,
    // redirect them directly to their preferred home page (or /dashboard)
    if (pathname === "/") {
        const accessToken = request.cookies.get("accessToken")?.value;
        if (accessToken) {
            const defaultHome = request.cookies.get("defaultHome")?.value || "/dashboard";
            return NextResponse.redirect(new URL(defaultHome, request.url));
        }
        return NextResponse.next();
    }

    // Allow public paths and static files
    if (
        pathname === "/sw.js" ||
        publicPaths.some((p) => pathname.startsWith(p)) ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api") ||
        pathname === "/favicon.ico" ||
        pathname === "/manifest.json" ||
        pathname.endsWith(".png") ||
        pathname.endsWith(".svg") ||
        pathname.endsWith(".ico") ||
        pathname.endsWith(".webp")
    ) {
        return NextResponse.next();
    }

    const accessToken = request.cookies.get("accessToken")?.value;

    if (!accessToken) {
        // Check for a marker that indicates client-side recovery is possible
        // (Zustand persist stores tokens in localStorage which middleware can't read,
        // so we give the client a chance to restore the cookie before hard-redirecting)
        const loginUrl = new URL("/login", request.url);
        if (pathname !== "/") {
            loginUrl.searchParams.set("redirect", pathname);
        }
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js).*)"],
};
