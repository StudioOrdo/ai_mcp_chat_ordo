import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkOrigin } from "@/lib/security/origin-check";
import { buildReferralPath } from "@/lib/referrals/referral-links";
import { LEGACY_REFERRAL_COOKIE_NAME } from "@/lib/referrals/referral-visit";
import { createRequestId } from "@/lib/observability/logger";

const SESSION_COOKIE = "lms_session_token";
const INSTALL_COOKIE = "ordo_installed";
const BASE_SECURITY_HEADERS = {
  "Content-Security-Policy": "frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

const ANONYMOUS_CONVERSATION_ROUTES = new Set([
  "/api/conversations/active",
  "/api/conversations/active/archive",
]);

const INSTALL_API_PREFIX = "/api/install";

function isStaticAssetPath(pathname: string): boolean {
  return pathname.startsWith("/_next/")
    || pathname === "/favicon.ico"
    || pathname === "/icon.png"
    || pathname === "/apple-icon.png"
    || pathname === "/robots.txt"
    || pathname === "/sitemap.xml"
    || /\.[a-zA-Z0-9]+$/.test(pathname);
}

function isInstallBypassPath(pathname: string): boolean {
  return pathname === "/install"
    || pathname.startsWith(INSTALL_API_PREFIX)
    || pathname.startsWith("/api/health/")
    || isStaticAssetPath(pathname);
}

function shouldRedirectToInstall(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/") || isInstallBypassPath(pathname)) {
    return false;
  }

  return request.cookies.get(INSTALL_COOKIE)?.value !== "1";
}

/**
 * Routes that require a session cookie to be present.
 * Full session validation happens in the route handler; the proxy only checks cookie presence.
 */
const PROTECTED_API_PREFIXES = [
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/switch",
];

function isProtectedRoute(pathname: string): boolean {
  if (ANONYMOUS_CONVERSATION_ROUTES.has(pathname)) {
    return false;
  }

  if (
    pathname === "/api/conversations" ||
    pathname.startsWith("/api/conversations/")
  ) {
    return true;
  }

  return PROTECTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function captureReferral(request: NextRequest): NextResponse | null {
  if (request.nextUrl.pathname !== "/") {
    return null;
  }

  const refCode = request.nextUrl.searchParams.get("ref")?.trim();
  if (!refCode) {
    return null;
  }

  const redirectUrl = new URL(buildReferralPath(refCode), request.url);
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== "ref") {
      redirectUrl.searchParams.set(key, value);
    }
  });

  const response = NextResponse.redirect(redirectUrl);
  if (request.cookies.get(LEGACY_REFERRAL_COOKIE_NAME)?.value) {
    response.cookies.delete(LEGACY_REFERRAL_COOKIE_NAME);
  }
  return applySecurityHeaders(response);
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [header, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }

  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = createRequestId(request.headers);

  function applyHeaders(response: NextResponse): NextResponse {
    response.headers.set("x-request-id", requestId);
    return applySecurityHeaders(response);
  }

  // CSRF: Origin check on state-mutating API requests
  if (pathname.startsWith("/api/")) {
    const originResult = checkOrigin(request);
    if (originResult) return applyHeaders(originResult);
  }

  if (!pathname.startsWith("/api/")) {
    const legacyReferralRedirect = captureReferral(request);
    if (legacyReferralRedirect) {
      return applyHeaders(legacyReferralRedirect);
    }

    if (shouldRedirectToInstall(request)) {
      return applyHeaders(NextResponse.redirect(new URL("/install", request.url)));
    }

    return applyHeaders(NextResponse.next());
  }

  if (isProtectedRoute(pathname)) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) {
      return applyHeaders(NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ));
    }
  }

  return applyHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
