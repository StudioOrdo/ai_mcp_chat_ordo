import { NextResponse } from "next/server";

import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import { getToolAvailabilityService } from "@/lib/tools/tool-availability-service";
import { getToolSettingsService } from "@/lib/tools/tool-settings-service";
import { getToolComposition } from "@/lib/chat/tool-composition-root";
import { isKnownToolName, isProtectedTool } from "@/lib/tools/tool-default-profile";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBundleToolNames(bundleId: string): string[] {
  const bundle = getToolComposition().registry.getBundles().find((candidate) => candidate.id === bundleId);
  if (!bundle) {
    throw new Error(`Unknown tool bundle "${bundleId}".`);
  }

  return [...bundle.toolNames].filter(isKnownToolName);
}

async function getStaticLockedToolNames(): Promise<Set<string>> {
  const manifest = await getToolAvailabilityService().getEffectiveManifestFromSettings();
  return new Set(manifest.tools.filter((tool) => tool.staticLocked).map((tool) => tool.name));
}

export async function GET() {
  await requireAdminPageAccess();

  const service = getToolAvailabilityService();
  const manifest = await service.getEffectiveManifestFromSettings();
  const registry = getToolComposition().registry;

  return NextResponse.json({
    manifest,
    countsByState: service.summarizeByState(manifest),
    bundles: registry.getBundles().map((bundle) => ({
      id: bundle.id,
      displayName: bundle.displayName,
      toolNames: bundle.toolNames,
    })),
  });
}

export async function POST(request: Request) {
  await requireAdminPageAccess();

  const body = await request.json() as unknown;
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const action = body.action;
  const settings = getToolSettingsService();
  const staticLockedToolNames = await getStaticLockedToolNames();

  if (action === "enable_tool" || action === "disable_tool") {
    const toolName = typeof body.toolName === "string" ? body.toolName : "";
    if (!isKnownToolName(toolName)) {
      return NextResponse.json({ error: `Unknown tool "${toolName}".` }, { status: 400 });
    }

    if (action === "disable_tool" && isProtectedTool(toolName)) {
      return NextResponse.json({
        error: `Protected tool "${toolName}" cannot be disabled through normal runtime controls.`,
      }, { status: 400 });
    }

    if (staticLockedToolNames.has(toolName)) {
      return NextResponse.json({
        error: `Tool "${toolName}" is locked by static config and cannot be changed through runtime controls.`,
      }, { status: 409 });
    }

    await settings.updateTool(toolName, action === "enable_tool");
  } else if (action === "enable_bundle" || action === "disable_bundle") {
    const bundleId = typeof body.bundleId === "string" ? body.bundleId : "";
    const toolNames = getBundleToolNames(bundleId)
      .filter((toolName) => action === "enable_bundle" || !isProtectedTool(toolName))
      .filter((toolName) => !staticLockedToolNames.has(toolName));
    await settings.updateTools(toolNames, action === "enable_bundle");
  } else {
    return NextResponse.json({ error: "Unsupported tool settings action." }, { status: 400 });
  }

  const service = getToolAvailabilityService();
  const manifest = await service.getEffectiveManifestFromSettings();
  return NextResponse.json({
    manifest,
    countsByState: service.summarizeByState(manifest),
  });
}
