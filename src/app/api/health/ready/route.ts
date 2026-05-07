import { NextResponse } from "next/server";
import { getReadinessProbe } from "@/lib/health/probes";

export async function GET() {
  const result = await getReadinessProbe();
  const statusCode = result.status === "ok" ? 200 : 503;
  return NextResponse.json(result, { status: statusCode });
}
