import { NextResponse } from "next/server";
import {
  parseLegacyProviderSettingsInput,
  parseProviderSettingsUpdateInput,
  providerSettingsService,
  isProviderSettingsFailure,
} from "@/lib/ai/providers/provider-settings-service";
import { guardInstallMutation } from "@/lib/appliance/install/install-token";

function parseInstallProviderPayload(body: unknown) {
  const legacy = parseLegacyProviderSettingsInput(body);
  if (legacy) {
    return legacy;
  }
  return parseProviderSettingsUpdateInput(body);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const guard = guardInstallMutation(request, body);
    if (!guard.ok) {
      return guard.response;
    }

    const parsed = parseInstallProviderPayload(body);
    if (isProviderSettingsFailure(parsed)) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: parsed.error.status }
      );
    }

    const result = await providerSettingsService.validateInstallSettings(parsed);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.message },
        { status: result.error.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API Key Validation Unexpected Error]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during validation." },
      { status: 500 }
    );
  }
}
