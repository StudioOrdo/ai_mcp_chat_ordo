import { NextResponse } from "next/server";
import {
  parseLegacyProviderSettingsInput,
  parseProviderSettingsUpdateInput,
  providerSettingsService,
  isProviderSettingsFailure,
} from "@/lib/ai/providers/provider-settings-service";
import { requireAdminPageAccess } from "@/lib/journal/admin-journal";

export async function GET() {
  await requireAdminPageAccess();
  return NextResponse.json({
    settings: providerSettingsService.getSettingsDto(),
  });
}

export async function POST(request: Request) {
  try {
    // Authenticate Admin
    await requireAdminPageAccess();

    const body = await request.json() as unknown;
    const parsed = parseLegacyProviderSettingsInput(body)
      ?? parseProviderSettingsUpdateInput(body);
    if (isProviderSettingsFailure(parsed)) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: parsed.error.status }
      );
    }

    const result = await providerSettingsService.applySettings(parsed);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.message },
        { status: result.error.status }
      );
    }

    return NextResponse.json({
      success: true,
      settings: providerSettingsService.getSettingsDto(),
    });
  } catch (error) {
    console.error("[Admin API Key Update Error]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
