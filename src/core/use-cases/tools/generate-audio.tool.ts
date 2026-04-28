import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import { GenerateAudioCommand } from "./UiTools";

import type { GenerateAudioRuntimePayloadInput } from "@/lib/audio/audio-generation-service";

export function parseGenerateAudioInput(value: unknown): GenerateAudioRuntimePayloadInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("generate_audio input must be an object.");
  }
  const v = value as Record<string, unknown>;
  if (typeof v.text !== "string" || typeof v.title !== "string") {
    throw new Error("generate_audio input missing text or title.");
  }
  return {
    text: v.text,
    title: v.title,
    assetId: typeof v.assetId === "string" ? v.assetId : undefined,
  };
}

export const generateAudioTool: ToolDescriptor = {
  name: "generate_audio",
  schema: {
    description: "Generate in-chat audio player.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string" },
        title: { type: "string" },
        assetId: { type: "string" },
      },
      required: ["text", "title"],
    },
  },
  command: new GenerateAudioCommand(),
  roles: ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
  category: "ui",
};
