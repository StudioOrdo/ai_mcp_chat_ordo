import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAllowedCsrfOrigins, resolvePublicOrigin } from "@/lib/appliance/network/public-origin";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function checkOrigin(req: NextRequest): NextResponse | null {
  if (SAFE_METHODS.has(req.method)) return null;

  const origin = req.headers.get("origin");
  if (!origin) return null;

  const host = req.headers.get("host");
  const allowedOrigins = getAllowedOrigins(host);

  if (!allowedOrigins.has(origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  return null;
}

function getAllowedOrigins(host: string | null): Set<string> {
  const resolution = resolvePublicOrigin();
  const origins = new Set<string>(getAllowedCsrfOrigins());

  if (resolution.mode === "local" && host) {
    origins.add(`https://${host}`);
    origins.add(`http://${host}`);
  }

  return origins;
}
