import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSystemEventDataMapper } from "@/adapters/RepositoryFactory";
import type { SystemEvent, SystemEventViewer } from "@/core/entities/system-event";
import { getSessionUser, resolveSessionAuthorizationRole } from "@/lib/auth";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

interface ChangeProjection {
  id: string;
  sequence: number;
  type: string;
  occurredAt: string;
  sectionIds: string[];
  objectRef: SystemEvent["objectRef"];
  summary: string;
  sourceRefs: SystemEvent["sourceRefs"];
}

function parseCursor(value: string | null): number | Response {
  if (value === null || value.trim() === "") return 0;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return NextResponse.json({
      error: "A valid non-negative after cursor is required.",
      errorCode: "VALIDATION_ERROR",
    }, { status: 400 });
  }
  return parsed;
}

function parseLimit(value: string | null): number {
  if (value === null || value.trim() === "") return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function toViewer(user: Awaited<ReturnType<typeof getSessionUser>>): SystemEventViewer | null {
  if (user.roles.includes("ANONYMOUS")) {
    return null;
  }
  return {
    userId: user.id,
    role: resolveSessionAuthorizationRole(user),
  };
}

function projectChange(event: SystemEvent): ChangeProjection {
  return {
    id: event.id,
    sequence: event.sequence,
    type: event.type,
    occurredAt: event.occurredAt,
    sectionIds: event.sectionIds,
    objectRef: event.objectRef,
    summary: event.summary,
    sourceRefs: event.sourceRefs,
  };
}

export async function GET(request: NextRequest) {
  const after = parseCursor(request.nextUrl.searchParams.get("after"));
  if (after instanceof Response) {
    return after;
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const section = request.nextUrl.searchParams.get("section")?.trim() || null;
  const user = await getSessionUser();
  const viewer = toViewer(user);
  const events = await getSystemEventDataMapper().listVisible({
    viewer,
    afterSequence: after,
    sectionId: section,
    limit,
  });
  const changes = events.map(projectChange);
  const cursor = changes.reduce(
    (max, change) => Math.max(max, change.sequence),
    after,
  );

  return NextResponse.json({
    cursor,
    hasMore: changes.length === limit,
    changes,
  });
}
