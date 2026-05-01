import path from "node:path";

import type { CapabilityDefinition } from "../capability-definition";
import { CATALOG_INPUT_SCHEMAS } from "../catalog-input-schemas";
import { COMPOSE_MEDIA_PROGRESS_PHASES } from "@/lib/media/compose-media-progress";
import {
  ADMIN_ROLES,
  SIGNED_IN_ROLES,
} from "./shared";

const PROJECT_ROOT = path.resolve(__dirname, "../../../..");
const TSX_BINARY = path.join(
  PROJECT_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx",
);

export const MEDIA_CAPABILITIES = {
  list_conversation_media_assets: {
    core: {
      name: "list_conversation_media_assets",
      label: "List Conversation Media Assets",
      description:
        "List reusable governed media assets already attached to the current conversation.",
      category: "system",
      roles: [...SIGNED_IN_ROLES],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.list_conversation_media_assets,
      outputHint: "Returns reusable conversation-scoped media assets with real governed asset IDs.",
    },
    runtime: {},
    executorBinding: {
      bundleId: "media",
      executorId: "list_conversation_media_assets",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "list_conversation_media_assets",
      mode: "parse",
    },
    presentation: {
      family: "system",
      cardKind: "fallback",
      executionMode: "inline",
    },
    promptHint: {
      roleDirectiveLines: {
        AUTHENTICATED: [
          "MEDIA ASSET DISCOVERY (`list_conversation_media_assets`): Call this BEFORE `compose_media` whenever you need to use a previously generated chart, graph, audio file, image (including blogasset_ hero images), or video. The returned assetId values are the exact canonical IDs to use in compose_media clips — copy them verbatim, character for character. Do NOT shorten, truncate, or reconstruct them from memory. Treat chart and graph asset IDs as valid direct compose inputs, not placeholders for unrelated screenshots.",
        ],
        APPRENTICE: [
          "MEDIA ASSET DISCOVERY (`list_conversation_media_assets`): Call this BEFORE `compose_media` whenever you need to use a previously generated chart, graph, audio file, image (including blogasset_ hero images), or video. The returned assetId values are the exact canonical IDs to use in compose_media clips — copy them verbatim, character for character. Do NOT shorten, truncate, or reconstruct them from memory. Treat chart and graph asset IDs as valid direct compose inputs, not placeholders for unrelated screenshots.",
        ],
        STAFF: [
          "MEDIA ASSET DISCOVERY (`list_conversation_media_assets`): Call this BEFORE `compose_media` whenever you need to use a previously generated chart, graph, audio file, image (including blogasset_ hero images), or video. The returned assetId values are the exact canonical IDs to use in compose_media clips — copy them verbatim, character for character. Do NOT shorten, truncate, or reconstruct them from memory. Treat chart and graph asset IDs as valid direct compose inputs, not placeholders for unrelated screenshots.",
        ],
        ADMIN: [
          "MEDIA ASSET DISCOVERY (`list_conversation_media_assets`): Call this BEFORE `compose_media` whenever you need to use a previously generated chart, graph, audio file, image (including blogasset_ hero images), or video. The returned assetId values are the exact canonical IDs to use in compose_media clips — copy them verbatim, character for character. Do NOT shorten, truncate, or reconstruct them from memory. Treat chart and graph asset IDs as valid direct compose inputs, not placeholders for unrelated screenshots.",
        ],
      },
    },
  },
  generate_chart: {
    core: {
      name: "generate_chart",
      label: "Generate Chart",
      description:
        "Generate a visual Mermaid.js chart. Prefer the structured spec for common chart families like flowcharts, pie charts, quadrants, xy charts, and mindmaps.",
      category: "content",
      roles: "ALL",
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.generate_chart,
    },
    runtime: {
      executionMode: undefined,
      deferred: undefined,
    },
    executorBinding: {
      bundleId: "media",
      executorId: "generate_chart",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "generate_chart",
      mode: "parse",
    },
    presentation: {
      family: "artifact",
      cardKind: "artifact_viewer",
      executionMode: "deferred",
      progressMode: "single",
      artifactKinds: ["chart"],
      supportsRetry: "whole_job",
    },
    job: {
      family: "media",
      label: "Generate Chart",
      description: "Generates a visual Mermaid chart from a structured specification.",
      executionPrincipal: "system_worker",
      executionAllowedRoles: SIGNED_IN_ROLES,
      retryPolicy: {
        mode: "automatic",
        maxAttempts: 2,
        backoffStrategy: "fixed",
        baseDelayMs: 2_000,
      },
      recoveryMode: "rerun",
      resultRetention: "retain",
      artifactPolicy: { mode: "retain" },
      initiatorRoles: SIGNED_IN_ROLES,
      ownerViewerRoles: SIGNED_IN_ROLES,
      ownerActionRoles: SIGNED_IN_ROLES,
      globalViewerRoles: ADMIN_ROLES,
      globalActionRoles: ADMIN_ROLES,
      defaultSurface: "self",
      progressPhases: [],
    },
  },
  generate_graph: {
    core: {
      name: "generate_graph",
      label: "Generate Graph",
      description:
        "Generate a quantitative graph or data table for time-series, comparisons, distributions, or trend visualizations.",
      category: "content",
      roles: "ALL",
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.generate_graph,
    },
    runtime: {
      executionMode: undefined,
      deferred: undefined,
    },
    executorBinding: {
      bundleId: "media",
      executorId: "generate_graph",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "generate_graph",
      mode: "parse",
    },
    presentation: {
      family: "artifact",
      cardKind: "artifact_viewer",
      executionMode: "deferred",
      progressMode: "single",
      artifactKinds: ["graph"],
      supportsRetry: "whole_job",
    },
    job: {
      family: "media",
      label: "Generate Graph",
      description: "Generates a quantitative graph or data table.",
      executionPrincipal: "system_worker",
      executionAllowedRoles: SIGNED_IN_ROLES,
      retryPolicy: {
        mode: "automatic",
        maxAttempts: 2,
        backoffStrategy: "fixed",
        baseDelayMs: 2_000,
      },
      recoveryMode: "rerun",
      resultRetention: "retain",
      artifactPolicy: { mode: "retain" },
      initiatorRoles: SIGNED_IN_ROLES,
      ownerViewerRoles: SIGNED_IN_ROLES,
      ownerActionRoles: SIGNED_IN_ROLES,
      globalViewerRoles: ADMIN_ROLES,
      globalActionRoles: ADMIN_ROLES,
      defaultSurface: "self",
      progressPhases: [],
    },
  },
  generate_audio: {
    core: {
      name: "generate_audio",
      label: "Generate Audio",
      description: "Generate in-chat audio player.",
      category: "content",
      roles: "ALL",
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.generate_audio,
    },
    runtime: {
      executionMode: "deferred",
      deferred: {
        retryable: true,
      },
    },
    localExecutionTargets: {
      mcpStdio: {
        processId: "generate-audio",
        toolName: "generate_audio",
      },
    },
    executorBinding: {
      bundleId: "media",
      executorId: "generate_audio",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "generate_audio",
      mode: "parse",
    },
    presentation: {
      family: "artifact",
      cardKind: "artifact_viewer",
      executionMode: "deferred",
      progressMode: "single",
      artifactKinds: ["audio"],
      supportsRetry: "whole_job",
    },
    job: {
      family: "media",
      label: "Generate Audio",
      description: "Generates an audio file via TTS.",
      executionPrincipal: "system_worker",
      executionAllowedRoles: SIGNED_IN_ROLES,
      retryPolicy: {
        mode: "automatic",
        maxAttempts: 2,
        backoffStrategy: "fixed",
        baseDelayMs: 2_000,
      },
      recoveryMode: "rerun",
      resultRetention: "retain",
      artifactPolicy: { mode: "retain" },
      initiatorRoles: SIGNED_IN_ROLES,
      ownerViewerRoles: SIGNED_IN_ROLES,
      ownerActionRoles: SIGNED_IN_ROLES,
      globalViewerRoles: ADMIN_ROLES,
      globalActionRoles: ADMIN_ROLES,
      defaultSurface: "self",
      progressPhases: [],
    },
  },
  compose_media: {
    core: {
      name: "compose_media",
      label: "Compose Media",
      description:
        "Compose, trim, and combine visual and audio assets into a new MP4 video. "
        + "Produces a unified artifact. You must provide governed asset handles.",
      category: "content",
      roles: ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
    },
    schema: {
      inputSchema: {
        type: "object",
        properties: {
          plan: {
            type: "object",
            description: "A MediaCompositionPlan describing the clips, policies, and output format.",
            properties: {
              id: { type: "string", description: "Unique plan identifier." },
              conversationId: { type: "string", description: "Conversation this plan belongs to." },
              visualClips: {
                type: "array",
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    assetId: { type: "string", description: "Governed asset handle." },
                    sourceAssetId: {
                      type: "string",
                      description: "Optional explicit source lineage handle. Set this when the chosen governed asset must stay bound to a specific freshly requested or selected source asset.",
                    },
                    kind: { type: "string", enum: ["image", "video", "chart", "graph"] },
                    startTime: { type: "number", description: "Optional clip trim start time in seconds." },
                    duration: { type: "number", description: "Optional clip duration in seconds." },
                  },
                  required: ["assetId", "kind"],
                },
              },
              audioClips: {
                type: "array",
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    assetId: { type: "string", description: "Governed asset handle." },
                    sourceAssetId: {
                      type: "string",
                      description: "Optional explicit source lineage handle. Set this when the chosen governed asset must stay bound to a specific freshly requested or selected source asset.",
                    },
                    kind: { type: "string", enum: ["audio"] },
                    startTime: { type: "number", description: "Optional clip trim start time in seconds." },
                    duration: { type: "number", description: "Optional clip duration in seconds." },
                  },
                  required: ["assetId", "kind"],
                },
              },
              profile: {
                type: "string",
                enum: ["auto", "still_image_narration_fast", "multi_video_standard"],
                description: "Optional composition profile. Use still_image_narration_fast for a short portrait still image plus narration. Use multi_video_standard for heavier multi-clip video assembly. Defaults to auto.",
              },
              subtitlePolicy: { type: "string", enum: ["none", "burned", "sidecar", "both"] },
              waveformPolicy: { type: "string", enum: ["none", "generate"] },
              outputFormat: { type: "string", enum: ["mp4", "webm"] },
              resolution: {
                type: "object",
                description: "Optional output dimensions. When omitted, auto uses a profile-specific default: 720x1280 for still_image_narration_fast and 1080x1920 for multi_video_standard.",
                properties: {
                  width: { type: "number", description: "Output width in pixels. Use this to override the profile default." },
                  height: { type: "number", description: "Output height in pixels. Use this to override the profile default." },
                },
                required: ["width", "height"],
              },
            },
            required: ["id", "conversationId", "visualClips", "audioClips"],
          },
        },
        required: ["plan"],
      },
      outputHint: "Returns a canonical compose job reference or exact materialization reuse result.",
    },
    executorBinding: {
      bundleId: "media",
      executorId: "compose_media",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "compose_media",
      mode: "parse",
    },
    localExecutionTargets: {
      nativeProcess: {
        processId: "compose-media-native",
        command: TSX_BINARY,
        args: ["scripts/compose-media-native-target.ts"],
        cwd: PROJECT_ROOT,
        entrypoint: "scripts/compose-media-native-target.ts",
        label: "Compose media native worker",
      },
    },
    runtime: {
      executionMode: undefined,
      deferred: undefined,
    },
    presentation: {
      family: "artifact",
      cardKind: "media_render",
      executionMode: "hybrid",
      progressMode: "single",
      artifactKinds: ["video", "audio"],
      supportsRetry: "whole_job",
    },
    job: {
      family: "media",
      label: "Compose Media",
      description:
        "Compose visual and audio assets into a governed MP4 video through canonical job execution.",
      executionPrincipal: "system_worker",
      executionAllowedRoles: SIGNED_IN_ROLES,
      retryPolicy: {
        mode: "automatic",
        maxAttempts: 10,
        backoffStrategy: "fixed",
        baseDelayMs: 3_000,
      },
      recoveryMode: "rerun",
      resultRetention: "retain",
      artifactPolicy: { mode: "retain" },
      initiatorRoles: SIGNED_IN_ROLES,
      ownerViewerRoles: SIGNED_IN_ROLES,
      ownerActionRoles: SIGNED_IN_ROLES,
      globalViewerRoles: ADMIN_ROLES,
      globalActionRoles: ADMIN_ROLES,
      defaultSurface: "self",
      progressPhases: COMPOSE_MEDIA_PROGRESS_PHASES,
    },
    browser: {
      runtimeKind: "wasm_worker",
      moduleId: "ffmpeg-browser-executor",
      supportedAssetKinds: ["video", "audio", "image", "subtitle", "waveform"],
      fallbackPolicy: "server",
      recoveryPolicy: "fallback_to_server",
      maxConcurrentExecutions: 1,
      requiresCrossOriginIsolation: true,
    },
    promptHint: {
      roleDirectiveLines: {
        AUTHENTICATED: [
          "MEDIA COMPOSITION (compose_media):",
          "- ALWAYS call `list_conversation_media_assets` first to discover the exact governed asset IDs before composing. Use the assetId values returned — copy them character-for-character.",
          "- **compose_media**: Compose, trim, and combine visual and audio assets into a new MP4 video.",
          "- You MUST provide a structured plan object with id, conversationId, visualClips, audioClips, and output settings.",
          "- Charts and graphs are valid direct visual clip asset IDs. Pass the selected chart/graph assetId through unchanged; do NOT swap in an unrelated uploaded image. If you must preserve the selected source across a derived image render, set clip.sourceAssetId to that original chart/graph assetId.",
          "- Use plan.profile=still_image_narration_fast for the default short still-image-plus-narration use case. Leave profile as auto if you want the system to choose based on clip shape.",
          "- CRITICAL — Asset ID rules: (1) NEVER use job_ IDs as asset IDs — job_ values are queue tracking keys, not asset handles. (2) blogasset_ IDs are full UUIDs — copy the complete value exactly; do NOT shorten or paraphrase them. (3) Only use assetId values from `list_conversation_media_assets` results or from the direct output of a generate_* tool.",
          "- If a clip must stay bound to a freshly requested or explicitly selected source asset, set clip.sourceAssetId to that original asset handle so readiness checks cannot silently swap in a different governed asset.",
          "- The video is owned by one canonical compose job and appears as a governed media card when complete.",
          "- Auto defaults to a fast 720x1280 portrait output for still-image narration and 1080x1920 for multi-video work. If the user asks for landscape, square, or exact dimensions, set plan.resolution explicitly.",
          "- Use this tool when the user asks to create a video, combine clips, add audio to video, or perform any media composition task.",
        ],
        APPRENTICE: [
          "MEDIA COMPOSITION (compose_media):",
          "- ALWAYS call `list_conversation_media_assets` first to discover the exact governed asset IDs before composing. Use the assetId values returned — copy them character-for-character.",
          "- **compose_media**: Compose, trim, and combine visual and audio assets into a new MP4 video.",
          "- You MUST provide a structured plan object with id, conversationId, visualClips, audioClips, and output settings.",
          "- Charts and graphs are valid direct visual clip asset IDs. Pass the selected chart/graph assetId through unchanged; do NOT swap in an unrelated uploaded image. If a derived image must stay tied to the selected source, set clip.sourceAssetId to that original chart/graph assetId.",
          "- CRITICAL — Asset ID rules: (1) NEVER use job_ IDs as asset IDs — job_ values are queue tracking keys, not asset handles. (2) blogasset_ IDs are full UUIDs — copy the complete value exactly; do NOT shorten or paraphrase them. (3) Only use assetId values from `list_conversation_media_assets` results or from the direct output of a generate_* tool.",
          "- If a clip must stay bound to a freshly requested or explicitly selected source asset, set clip.sourceAssetId to that original asset handle.",
          "- For the common still-image narration case, set plan.profile to still_image_narration_fast or leave it as auto and provide one image plus narration audio.",
        ],
        STAFF: [
          "MEDIA COMPOSITION (compose_media):",
          "- ALWAYS call `list_conversation_media_assets` first to discover the exact governed asset IDs before composing. Use the assetId values returned — copy them character-for-character.",
          "- **compose_media**: Compose, trim, and combine visual and audio assets into a new MP4 video.",
          "- You MUST provide a structured plan object with id, conversationId, visualClips, audioClips, and output settings.",
          "- Charts and graphs are valid direct visual clip asset IDs. Pass the selected chart/graph assetId through unchanged; do NOT swap in an unrelated uploaded image. If a derived image must stay tied to the selected source, set clip.sourceAssetId to that original chart/graph assetId.",
          "- CRITICAL — Asset ID rules: (1) NEVER use job_ IDs as asset IDs — job_ values are queue tracking keys, not asset handles. (2) blogasset_ IDs are full UUIDs — copy the complete value exactly; do NOT shorten or paraphrase them. (3) Only use assetId values from `list_conversation_media_assets` results or from the direct output of a generate_* tool.",
          "- If a clip must stay bound to a freshly requested or explicitly selected source asset, set clip.sourceAssetId to that original asset handle.",
          "- For the common still-image narration case, set plan.profile to still_image_narration_fast or leave it as auto and provide one image plus narration audio.",
        ],
        ADMIN: [
          "MEDIA COMPOSITION (compose_media — canonical job execution):",
          "- ALWAYS call `list_conversation_media_assets` first to discover the exact governed asset IDs before composing. Use the assetId values returned — copy them character-for-character.",
          "- **compose_media**: Compose, trim, and combine visual and audio assets into a new MP4 video.",
          "- You MUST provide a structured plan object with: id (unique string), conversationId, visualClips (array of {assetId, kind, sourceAssetId?}), audioClips (array of {assetId, kind, sourceAssetId?}), and optional subtitlePolicy, waveformPolicy, outputFormat.",
          "- Charts and graphs are valid direct visual clip asset IDs. Pass the selected chart/graph assetId through unchanged; do NOT swap in an unrelated uploaded image. When materialization derives an image, keep clip.sourceAssetId bound to the original chart/graph assetId so browser and deferred preflight enforce the lineage.",
          "- plan.profile supports auto, still_image_narration_fast, and multi_video_standard. The first is the common short narration preset; the second heavier preset is for future multi-video work.",
          "- CRITICAL — Asset ID rules: (1) NEVER use job_ IDs as asset IDs — job_ values are queue tracking keys, not asset handles. (2) blogasset_ IDs are full UUIDs — copy the complete value exactly as returned by list_conversation_media_assets; do NOT shorten or paraphrase them. (3) Only use assetId values from `list_conversation_media_assets` results or from the direct output of a generate_* tool.",
          "- Use clip.sourceAssetId when a selected governed asset must remain bound to a freshly requested or explicitly chosen source asset. Browser and deferred preflight both enforce that lineage.",
          "- The video is owned by one canonical compose job. Browser execution may only run when the server assigns a canonical job to that executor.",
          "- Auto uses a fast 720x1280 portrait default for still-image narration and 1080x1920 for multi-video work. If the user asks for landscape, square, or exact dimensions, set plan.resolution explicitly.",
          "- Use this tool when the user asks to create a video, combine clips, add audio to video, trim media, or perform any media composition task.",
          "- This is a deferred job — the result appears as a media card in the conversation with playback controls.",
        ],
      },
    },
  },
} as const satisfies Record<string, CapabilityDefinition>;
