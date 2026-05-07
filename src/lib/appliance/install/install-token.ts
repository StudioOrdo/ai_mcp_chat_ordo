import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAllowedCsrfOrigins, resolvePublicOrigin } from "@/lib/appliance/network/public-origin";
import { resolveInstallState } from "@/lib/appliance/install/install-state";
import { resolveRuntimeSecret } from "@/lib/config/secret-source";

export type InstallGuardResult = {
  ok: true;
} | {
  ok: false;
  response: NextResponse;
};

function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  const publicOrigin = resolvePublicOrigin();
  if (publicOrigin.mode === "local") {
    return true;
  }

  return new Set(getAllowedCsrfOrigins()).has(origin);
}

function tokenFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  return normalizeToken((body as { installToken?: unknown }).installToken);
}

export function verifyHostedInstallToken(request: Request, body: unknown): boolean {
  const expected = resolveRuntimeSecret("ORDO_INSTALL_TOKEN").value;
  const submitted = normalizeToken(request.headers.get("x-ordo-install-token")) ?? tokenFromBody(body);
  return Boolean(expected && submitted && safeEqual(expected, submitted));
}

export function guardInstallMutation(request: Request, body: unknown): InstallGuardResult {
  const state = resolveInstallState();
  if (state.state === "blocked") {
    return {
      ok: false,
      response: NextResponse.json({ error: state.message ?? "Install is unavailable." }, { status: 500 }),
    };
  }

  if (state.ownerConfigured) {
    return {
      ok: false,
      response: NextResponse.json({ error: "System is already initialized." }, { status: 400 }),
    };
  }

  if (!originAllowed(request)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Origin not allowed." }, { status: 403 }),
    };
  }

  if (state.installTokenRequired && !verifyHostedInstallToken(request, body)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Valid install token required." }, { status: 403 }),
    };
  }

  return { ok: true };
}
