import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { CAPABILITY_CATALOG } from "@/core/capability-catalog/catalog";
import {
  buildGenerateAudioRuntimePayload,
  generateStoredAudioArtifact,
} from "@/lib/audio/audio-generation-service";
import { loadLocalEnv } from "../scripts/load-local-env";

loadLocalEnv();

const FIXTURE_ENV = "ORDO_MCP_GENERATE_AUDIO_RESULT_FIXTURE";

function readFixtureResult(): unknown | null {
  const raw = process.env[FIXTURE_ENV];
  if (!raw) {
    return null;
  }
  return JSON.parse(raw);
}

function parseGenerateAudioArgs(args: unknown): { text: string; title: string } {
  if (!args || typeof args !== "object") {
    return { text: "", title: "" };
  }

  const record = args as Record<string, unknown>;
  return {
    text: typeof record.text === "string" ? record.text : "",
    title: typeof record.title === "string" ? record.title : "",
  };
}

async function executeServerGenerateAudio(args: unknown): Promise<unknown> {
  const { text, title } = parseGenerateAudioArgs(args);

  const fixture = readFixtureResult();
  if (fixture) {
    return fixture;
  }

  // The MCP server has no user session, so it operates as an anonymous system
  // worker. The deferred job handler passes the correct userId via the job
  // payload; at this sidecar boundary we use a sentinel that is overwritten
  // by the deferred-job layer's resolution.
  const userId = process.env.ORDO_SYSTEM_WORKER_USER_ID ?? "system";

  const resolved = await generateStoredAudioArtifact({
    userId,
    text,
    conversationId: null,
  });

  return buildGenerateAudioRuntimePayload({ title, text }, resolved);
}

const server = new Server(
  {
    name: "generate-audio-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: CAPABILITY_CATALOG.generate_audio.core.name,
      description: CAPABILITY_CATALOG.generate_audio.core.description,
      inputSchema: CAPABILITY_CATALOG.generate_audio.schema.inputSchema,
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== CAPABILITY_CATALOG.generate_audio.core.name) {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const result = await executeServerGenerateAudio(request.params.arguments ?? {});

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result),
      },
    ],
  };
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
