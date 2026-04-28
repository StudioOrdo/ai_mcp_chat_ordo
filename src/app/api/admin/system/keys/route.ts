import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { ConfigurationService } from "@/lib/config/ConfigurationService";
import { requireAdminPageAccess } from "@/lib/journal/admin-journal";

function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const nestedError = (error as { error?: { error?: { message?: string }; message?: string } }).error;
    return nestedError?.error?.message ?? nestedError?.message ?? fallback;
  }

  return fallback;
}

export async function POST(request: Request) {
  try {
    // Authenticate Admin
    await requireAdminPageAccess();

    const { anthropicKey, openAiKey } = await request.json() as {
      anthropicKey?: string;
      openAiKey?: string;
    };

    if (!anthropicKey && !openAiKey) {
      return NextResponse.json(
        { error: "No keys provided to update." },
        { status: 400 }
      );
    }

    // 1. Validate Anthropic Key (if provided)
    if (anthropicKey) {
      try {
        const anthropic = new Anthropic({ apiKey: anthropicKey });
        await anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 1,
          messages: [{ role: "user", content: "Ping" }],
        });
      } catch (error) {
        console.error("[Anthropic Admin Validation Error]", error);
        const msg = extractApiErrorMessage(error, "Invalid Anthropic API Key.");
        return NextResponse.json(
          { error: `Anthropic Error: ${msg}` },
          { status: 400 }
        );
      }
      ConfigurationService.setString("ANTHROPIC_API_KEY", anthropicKey);
    }

    // 2. Validate OpenAI Key (if provided)
    if (openAiKey) {
      try {
        const openai = new OpenAI({ apiKey: openAiKey });
        await openai.models.list();
      } catch (error) {
        console.error("[OpenAI Admin Validation Error]", error);
        const msg = extractApiErrorMessage(error, "Invalid OpenAI API Key.");
        return NextResponse.json(
          { error: `OpenAI Error: ${msg}` },
          { status: 400 }
        );
      }
      ConfigurationService.setString("OPENAI_API_KEY", openAiKey);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin API Key Update Error]", error);
    return NextResponse.json(
      { error: extractApiErrorMessage(error, "An unexpected error occurred.") },
      { status: 500 }
    );
  }
}
