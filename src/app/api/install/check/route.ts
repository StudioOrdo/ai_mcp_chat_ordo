import { NextResponse } from "next/server";
import { ensureDbSchema } from "@/lib/db";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Environment check failed.";
}

export async function GET() {
  try {
    // Attempt to access the DB and ensure the schema exists.
    // If the .data folder isn't writable, this will throw an error.
    ensureDbSchema();

    return NextResponse.json({ ready: true });
  } catch (error) {
    console.error("[Install Check Error]", error);
    return NextResponse.json(
      { ready: false, message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
