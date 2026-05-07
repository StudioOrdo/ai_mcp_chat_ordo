import { NextResponse } from "next/server";
import { resolveInstallState } from "@/lib/appliance/install/install-state";

export async function GET() {
  const state = resolveInstallState();
  return NextResponse.json(state, { status: state.ready ? 200 : 500 });
}
