import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/register", "/forgot-password", "/locate"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public paths and static files
    if (
        publicPaths.some((p) => pathname.startsWith(p)) ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api") ||
        pathname === "/favicon.ico" ||
        pathname === "/manifest.json"
    ) {
        return NextResponse.next();
    }

    const accessToken = request.cookies.get("accessToken")?.value;

    if (!accessToken) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json).*)"],
};
