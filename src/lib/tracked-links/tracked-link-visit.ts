import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { getEnvConfig } from "@/lib/config/env-config";

export const TRACKED_LINK_VISIT_COOKIE_NAME = "ordo_tracked_link_visit";
const TRACKED_LINK_VISIT_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type TrackedLinkVisitPayload = {
  visitId: string;
  code: string;
  issuedAt: string;
};

export interface ValidatedTrackedLinkVisit {
  visitId: string;
  code: string;
  issuedAt: string;
}

function getTrackedLinkCookieSecret(): string {
  const explicitSecret = process.env.TRACKED_LINK_COOKIE_SECRET?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (jwtSecret) {
    return jwtSecret;
  }

  if (getEnvConfig().NODE_ENV === "production") {
    throw new Error("TRACKED_LINK_COOKIE_SECRET or JWT_SECRET must be set in production.");
  }

  return "studio-ordo-local-tracked-link-secret";
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signTrackedLinkVisitPayload(encodedPayload: string): string {
  return createHmac("sha256", getTrackedLinkCookieSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createTrackedLinkVisitCookieValue(code: string): string {
  const payload: TrackedLinkVisitPayload = {
    visitId: randomUUID(),
    code,
    issuedAt: new Date().toISOString(),
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signTrackedLinkVisitPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function getTrackedLinkVisitCookieOptions() {
  return {
    path: "/",
    maxAge: TRACKED_LINK_VISIT_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function resolveValidatedTrackedLinkVisit(cookieValue: string | undefined | null): ValidatedTrackedLinkVisit | null {
  if (!cookieValue) {
    return null;
  }

  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signTrackedLinkVisitPayload(encodedPayload);
  const providedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(encodedPayload)) as TrackedLinkVisitPayload;
    if (
      typeof parsed.visitId !== "string"
      || typeof parsed.code !== "string"
      || typeof parsed.issuedAt !== "string"
      || parsed.visitId.length === 0
      || parsed.code.length === 0
      || parsed.issuedAt.length === 0
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
