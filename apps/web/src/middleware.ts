import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/register", "/forgot-password", "/locate", "/p/"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public paths, landing page, and static files
    if (
        pathname === "/" ||
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
    matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json).*)"],
};
