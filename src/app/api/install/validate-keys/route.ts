import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { ConfigurationService } from "@/lib/config/ConfigurationService";

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
    const isInitialized = ConfigurationService.isSystemInitialized();
    if (isInitialized) {
      return NextResponse.json(
        { error: "System is already initialized." },
        { status: 400 }
      );
    }

    const { anthropicKey, openAiKey } = await request.json() as {
      anthropicKey?: string;
      openAiKey?: string;
    };

    if (!anthropicKey) {
      return NextResponse.json(
        { error: "Anthropic API Key is required." },
        { status: 400 }
      );
    }

    // 1. Validate Anthropic Key
    try {
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      // A minimal request to verify the key
      await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "Ping" }],
      });
    } catch (error) {
      console.error("[Anthropic Validation Error]", error);
      const msg = extractApiErrorMessage(error, "Invalid Anthropic API Key.");
      return NextResponse.json(
        { error: `Anthropic Error: ${msg}` },
        { status: 400 }
      );
    }

    // 2. Validate OpenAI Key (if provided)
    if (openAiKey) {
      try {
        const openai = new OpenAI({ apiKey: openAiKey });
        // The fastest, cheapest endpoint to verify auth
        await openai.models.list();
      } catch (error) {
        console.error("[OpenAI Validation Error]", error);
        const msg = extractApiErrorMessage(error, "Invalid OpenAI API Key.");
        return NextResponse.json(
          { error: `OpenAI Error: ${msg}` },
          { status: 400 }
        );
      }
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
