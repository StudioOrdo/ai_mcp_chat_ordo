import type { NextRequest } from "next/server";
import QRCode from "qrcode";

import { createRateLimiter } from "@/lib/rate-limit";
import { getTrackedLinkService } from "@/lib/tracked-links/tracked-link-service";
import { buildPublicTrackedLinkUrl } from "@/lib/tracked-links/tracked-link-origin";

const limiter = createRateLimiter(60_000, 60);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!limiter(ip)) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { code } = await context.params;
  if (!code || code.length > 48) {
    return Response.json({ error: "Tracked link not found" }, { status: 404 });
  }

  const link = await getTrackedLinkService().findActiveByCode(code);
  if (!link) {
    return Response.json({ error: "Tracked link not found" }, { status: 404 });
  }

  const buffer = await QRCode.toBuffer(buildPublicTrackedLinkUrl(code), {
    type: "png",
    width: 300,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
