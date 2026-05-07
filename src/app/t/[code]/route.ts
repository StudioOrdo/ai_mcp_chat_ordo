import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getTrackedLinkService } from "@/lib/tracked-links/tracked-link-service";
import {
  createTrackedLinkVisitCookieValue,
  getTrackedLinkVisitCookieOptions,
  resolveValidatedTrackedLinkVisit,
  TRACKED_LINK_VISIT_COOKIE_NAME,
} from "@/lib/tracked-links/tracked-link-visit";

function unavailableRedirect(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/offers?link=unavailable", request.url), { status: 307 });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  if (!code || code.length > 48) {
    return unavailableRedirect(request);
  }

  const existingCookieValue = request.cookies.get(TRACKED_LINK_VISIT_COOKIE_NAME)?.value;
  const existingVisit = resolveValidatedTrackedLinkVisit(existingCookieValue);
  const cookieValue = existingVisit?.code === code
    ? existingCookieValue ?? createTrackedLinkVisitCookieValue(code)
    : createTrackedLinkVisitCookieValue(code);
  const visit = resolveValidatedTrackedLinkVisit(cookieValue);

  if (!visit) {
    return unavailableRedirect(request);
  }

  const { link } = await getTrackedLinkService().recordPublicVisit({
    code,
    anonymousVisitId: visit.visitId,
    userAgent: request.headers.get("user-agent"),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  if (!link) {
    return unavailableRedirect(request);
  }

  const response = NextResponse.redirect(new URL(link.destinationUrl, request.url), { status: 307 });
  response.cookies.set(
    TRACKED_LINK_VISIT_COOKIE_NAME,
    cookieValue,
    getTrackedLinkVisitCookieOptions(),
  );
  return response;
}
