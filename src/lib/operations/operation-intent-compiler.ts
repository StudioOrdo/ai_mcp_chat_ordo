import type { OperationKind, OperationRiskLevel } from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";
import type { OperationIntentCompiler } from "@/core/use-cases/operations/OperationIntentCompiler";
import type {
  OperationIntentCompilerInput,
  OperationIntentCompilerOutput,
  OperationIntentOperationOutput,
} from "@/core/use-cases/operations/OperationIntent";

const BACKUP_CREATE_PATTERN = /\b(create|run|take|make|start|queue)\b[\s\S]{0,80}\b(backup|snapshot)\b|\b(backup|snapshot)\b[\s\S]{0,80}\b(create|run|take|make|start|queue)\b/i;
const RESTORE_PATTERN = /\b(restore|rollback|roll back|recover)\b/i;
const DESTRUCTIVE_PATTERN = /\b(restore|rollback|roll back|recover|overwrite|delete|destroy|fire it|execute restore)\b/i;
const MEDIA_PATTERN = /\b(video|clip|reel|audio|voiceover|narration|image|hero image|chart|graph|compose media|combine .*media|render)\b/i;
const FACTORY_PATTERN = /\b(implement|refactor|fix|debug|qa|test|ship|release|github issue|work order|software factory|build .*app|fastapi|frontend|docker)\b/i;
const CONTENT_PUBLISH_PATTERN = /\b(publish|release|go live|deploy content|send newsletter)\b/i;
const ONBOARDING_PATTERN = /\b(onboard|setup|set up my account|first user|getting started|walk me through)\b/i;
const HELP_PATTERN = /\b(help|docs|documentation|how do i|how should i|explain ordo|what can you do)\b/i;
const BACKUP_ID_PATTERN = /\bbackup_[A-Za-z0-9_-]{6,}\b/g;
const FULL_BACKUP_ID_MIN_SUFFIX_LENGTH = 12;

export class DeterministicOperationIntentCompiler implements OperationIntentCompiler {
  compile(input: OperationIntentCompilerInput): OperationIntentCompilerOutput {
    const text = input.latestUserText.trim();
    if (!text) {
      return passThrough("empty_message");
    }

    const lower = text.toLowerCase();
    const backupId = extractBackupId(text);

    if (RESTORE_PATTERN.test(text)) {
      if (!backupId) {
        return {
          kind: "clarification_required",
          confidence: 0.92,
          source: "deterministic",
          operationKind: "restore_execute",
          riskLevel: "destructive",
          reason: "restore_missing_backup_id",
          missingInputs: ["snapshotId"],
          question: "Which exact backup should I restore from? Provide the full backup id before I create a restore operation.",
        };
      }

      if (backupId.ambiguous) {
        return {
          kind: "clarification_required",
          confidence: 0.9,
          source: "deterministic",
          operationKind: "restore_execute",
          riskLevel: "destructive",
          reason: "restore_ambiguous_backup_id",
          missingInputs: ["snapshotId"],
          question: `The backup id "${backupId.value}" looks like a short prefix. Provide the full backup id so I do not guess the restore target.`,
        };
      }

      return operationIntent({
        operationKind: "restore_execute",
        role: "ADMIN",
        riskLevel: "destructive",
        confidence: 0.95,
        title: "Restore Appliance",
        summary: `Prepare a governed appliance restore from ${backupId.value}.`,
        input: {
          snapshotId: backupId.value,
          requestedText: text,
        },
        requiredCapabilities: [
          "prepare_appliance_restore",
          "request_pre_restore_backup",
          "execute_appliance_restore",
        ],
        requiredProviderSlots: [],
      });
    }

    if (BACKUP_CREATE_PATTERN.test(text)) {
      return operationIntent({
        operationKind: "backup_create",
        role: "ADMIN",
        riskLevel: "medium",
        confidence: 0.93,
        title: "Create Appliance Backup",
        summary: "Create a governed appliance backup draft.",
        input: {
          requestedText: text,
        },
        requiredCapabilities: ["create_appliance_backup"],
        requiredProviderSlots: [],
      });
    }

    if (MEDIA_PATTERN.test(text) && /\b(create|make|generate|compose|combine|render|retry|fix)\b/i.test(text)) {
      const mediaIntent = compileMediaIntent(input, text, lower);
      if (mediaIntent) {
        return mediaIntent;
      }

      return {
        kind: "clarification_required",
        confidence: 0.86,
        source: "deterministic",
        operationKind: "media_workflow",
        riskLevel: "medium",
        reason: "media_workflow_needs_supported_template_inputs",
        missingInputs: ["visualAssetId", "audioText"],
        question: "I can only create a durable video workflow after I have a concrete visual asset and audio text, or a valid compose plan. Tell me the asset id to use and the narration text, or ask for an audio-only generation first.",
      };
    }

    if (FACTORY_PATTERN.test(text)) {
      return operationIntent({
        operationKind: "factory_work_order",
        role: input.role === "ADMIN" ? "ADMIN" : "STAFF",
        riskLevel: "medium",
        confidence: 0.82,
        title: "Create Factory Work Order",
        summary: "Create a governed software factory work-order draft.",
        input: {
          requestedText: text,
        },
        requiredCapabilities: [],
        requiredProviderSlots: [],
      });
    }

    if (CONTENT_PUBLISH_PATTERN.test(text)) {
      return operationIntent({
        operationKind: "content_publish",
        role: input.role === "ADMIN" ? "ADMIN" : "STAFF",
        riskLevel: "high",
        confidence: 0.81,
        title: "Review Content Publish",
        summary: "Create a governed content-publish draft.",
        input: {
          requestedText: text,
        },
        requiredCapabilities: [],
        requiredProviderSlots: [],
      });
    }

    if (ONBOARDING_PATTERN.test(text)) {
      return operationIntent({
        operationKind: "onboarding_flow",
        role: input.role,
        riskLevel: "info",
        confidence: 0.86,
        title: "Start Onboarding",
        summary: "Create a role-aware onboarding flow draft.",
        input: {
          requestedText: text,
        },
        requiredCapabilities: [],
        requiredProviderSlots: [],
      });
    }

    if (HELP_PATTERN.test(text) && /\bordo|system|backup|restore|admin|staff|docs|documentation\b/i.test(text)) {
      return operationIntent({
        operationKind: "help_flow",
        role: input.role,
        riskLevel: "info",
        confidence: 0.8,
        title: "Open System Help",
        summary: "Create a role-aware system help flow draft.",
        input: {
          requestedText: text,
        },
        requiredCapabilities: [],
        requiredProviderSlots: [],
      });
    }

    if (DESTRUCTIVE_PATTERN.test(text)) {
      return {
        kind: "clarification_required",
        confidence: 0.56,
        source: "deterministic",
        riskLevel: "destructive",
        reason: "destructive_terms_without_operation_target",
        question: "This sounds like it may change appliance state. What exact operation and target should I prepare?",
      };
    }

    return passThrough("normal_chat");
  }
}

function compileMediaIntent(
  input: OperationIntentCompilerInput,
  text: string,
  lower: string,
): OperationIntentOperationOutput | null {
  const asksForVideo = /\b(video|clip|reel|compose|combine|render)\b/i.test(text);
  const asksForImage = /\b(image|hero image|picture|visual|artwork)\b/i.test(text);
  const asksForAudio = /\b(audio|voiceover|voice over|narration|speech)\b/i.test(text);

  if (asksForAudio && !asksForVideo && !asksForImage) {
    return operationIntent({
      operationKind: "media_workflow",
      role: input.role === "ANONYMOUS" ? "AUTHENTICATED" : input.role,
      riskLevel: "medium",
      confidence: 0.86,
      title: "Generate Audio",
      summary: "Create a governed audio generation workflow.",
      input: {
        requestedText: text,
        requestedDeliverable: "audio",
        template: "generated_audio",
        audio: {
          title: "Generated audio",
          text,
        },
      },
      requiredCapabilities: ["generate_audio"],
      requiredProviderSlots: ["tts"],
    });
  }

  if (asksForVideo || (asksForImage && asksForAudio) || lower.includes("combine")) {
    return null;
  }

  return null;
}

function operationIntent(input: {
  operationKind: OperationKind;
  role: RoleName;
  riskLevel: OperationRiskLevel;
  confidence: number;
  title: string;
  summary: string;
  input: Record<string, unknown>;
  requiredCapabilities: readonly string[];
  requiredProviderSlots: readonly string[];
}): OperationIntentOperationOutput {
  return {
    kind: "operation_intent",
    intentKind: input.operationKind,
    operationKind: input.operationKind,
    requiredRole: input.role,
    riskLevel: input.riskLevel,
    confidence: input.confidence,
    title: input.title,
    summary: input.summary,
    input: input.input,
    requiredCapabilities: input.requiredCapabilities,
    requiredProviderSlots: input.requiredProviderSlots,
    missingInputs: [],
    source: "deterministic",
  };
}

function passThrough(reason: string): OperationIntentCompilerOutput {
  return {
    kind: "pass_through",
    confidence: 0.99,
    source: "deterministic",
    reason,
  };
}

function extractBackupId(text: string): { value: string; ambiguous: boolean } | null {
  const matches = [...text.matchAll(BACKUP_ID_PATTERN)].map((match) => match[0]);
  if (matches.length === 0) {
    return null;
  }

  const value = matches[0];
  const suffix = value.slice("backup_".length);
  return {
    value,
    ambiguous: matches.length > 1 || suffix.length < FULL_BACKUP_ID_MIN_SUFFIX_LENGTH,
  };
}
