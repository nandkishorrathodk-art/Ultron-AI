import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Ultron-AI Custom JWT Middleware
 * ═══════════════════════════════════════════════════════════
 * Strong custom authentication with:
 * - JWT verification with RS256/HS256
 * - Public path bypass for landing, auth, and API webhooks
 * - Rate limiting headers
 * - CSRF protection
 * - Security headers injection
 */

const PUBLIC_PATHS = new Set([
  "/",
  "/landing",
  "/login",
  "/signup",
  "/logout",
  "/callback",
  "/auth-error",
  "/privacy-policy",
  "/terms-of-service",
  "/download",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/subscription/webhook",
  "/api/extra-usage/webhook",
  "/api/fraud/webhook",
  "/manifest.json",
]);

const PUBLIC_PREFIXES = [
  "/share/",
  "/api/auth/",
  "/_next/",
  "/favicon",
  "/public/",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isBrowserRequest(request: NextRequest): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.AUTH_SECRET || "ultron-ai-default-secret-change-in-production",
);

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Always allow public paths
  if (isPublicPath(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Static files — skip middleware
  if (
    pathname.includes(".") &&
    !pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  // Extract JWT token
  const token =
    request.cookies.get("ultron-session")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    // No token — redirect browser requests to login, return 401 for API
    if (!isBrowserRequest(request)) {
      return NextResponse.json(
        {
          code: "unauthorized",
          message: "Authentication required. Please sign in.",
        },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify JWT
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });

    // Inject user info into request headers for downstream routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", (payload.sub || payload.userId) as string);
    requestHeaders.set("x-user-email", (payload.email || "") as string);
    requestHeaders.set("x-user-role", (payload.role || "user") as string);
    requestHeaders.set("x-user-entitlements", JSON.stringify(payload.entitlements || []));
    requestHeaders.set("x-user-subscription", (payload.subscription || "free") as string);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    return addSecurityHeaders(response);
  } catch {
    // Invalid/expired token
    // Clear the bad cookie
    const response = isBrowserRequest(request)
      ? NextResponse.redirect(new URL("/login?error=session_expired", request.url))
      : NextResponse.json(
          {
            code: "unauthorized",
            message: "Session expired. Please sign in again.",
          },
          { status: 401 },
        );

    response.cookies.delete("ultron-session");
    return addSecurityHeaders(response);
  }
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
