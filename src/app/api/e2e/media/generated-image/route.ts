import { NextResponse } from "next/server";

import { getUserFileDataMapper } from "@/adapters/RepositoryFactory";
import { getSessionUser } from "@/lib/auth";
import { OpenAiBlogImageProvider } from "@/adapters/OpenAiBlogImageProvider";
import { ProviderClientFactory } from "@/lib/ai/providers/provider-client-factory";
import { ProviderConfigService } from "@/lib/ai/providers/provider-config-service";
import { assertProviderBackedToolAvailable } from "@/lib/tools/tool-provider-capability-policy";
import { UserFileSystem } from "@/lib/user-files";

const HARNESS_ENABLED = process.env.ORDO_ENABLE_MEDIA_E2E_HARNESS === "1";

function getExtensionFromMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
}

export async function POST(request: Request) {
  if (!HARNESS_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getSessionUser();
  if (user.roles[0] === "ANONYMOUS") {
    return NextResponse.json({ error: "Authentication required." }, { status: 403 });
  }

  try {
    const body = await request.json() as {
      prompt?: unknown;
      altText?: unknown;
      conversationId?: unknown;
    };

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const altText = typeof body.altText === "string" ? body.altText.trim() : "";
    const conversationId = typeof body.conversationId === "string" && body.conversationId.trim().length > 0
      ? body.conversationId.trim()
      : null;

    if (!prompt || !altText) {
      return NextResponse.json({ error: "prompt and altText are required." }, { status: 400 });
    }

    assertProviderBackedToolAvailable("generate_blog_image");
    const provider = new OpenAiBlogImageProvider(
      ProviderClientFactory.createOpenAiClient(
        ProviderConfigService.resolveOpenAiApiKey().value,
      ),
    );
    const generated = await provider.generate({
      prompt,
      size: "1024x1024",
      quality: "high",
      enhancePrompt: true,
    });

    const stored = await new UserFileSystem(getUserFileDataMapper()).storeBinary({
      userId: user.id,
      conversationId,
      fileType: "image",
      mimeType: generated.mimeType,
      extension: getExtensionFromMimeType(generated.mimeType),
      data: generated.bytes,
      metadata: {
        assetKind: "image",
        source: "generated",
        retentionClass: conversationId ? "conversation" : "ephemeral",
        ...(typeof generated.width === "number" ? { width: generated.width } : {}),
        ...(typeof generated.height === "number" ? { height: generated.height } : {}),
      },
    });

    return NextResponse.json({
      assetId: stored.id,
      mimeType: stored.mimeType,
      uri: `/api/user-files/${stored.id}`,
      width: stored.metadata?.width ?? null,
      height: stored.metadata?.height ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate image." },
      { status: 500 },
    );
  }
}
