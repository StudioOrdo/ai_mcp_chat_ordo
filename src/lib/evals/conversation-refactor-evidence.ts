import fs from "node:fs";
import path from "node:path";

export type ConversationRefactorCoverageStatus = "covered" | "partial" | "missing" | "misleading" | "guarded";

export interface ConversationRefactorQaStepResult {
  label: string;
  command: string;
  status: "passed" | "failed" | "skipped";
}

export interface ConversationRefactorSurfaceEvidence {
  id: string;
  surface: string;
  status: ConversationRefactorCoverageStatus;
  currentAuthority: string;
  files: string[];
  tables: string[];
  preservedBehavior: string[];
  negativeCases: string[];
  nextProof: string;
}

export interface ConversationRefactorPhase00Evidence {
  version: 1;
  generatedAt: string;
  bundleId: "conversation-refactor-phase-00-02b-operator-transition-and-trust-distribution";
  phase: "00-02B";
  status: "passed" | "failed";
  coverage: {
    accounting: Record<ConversationRefactorCoverageStatus, string[]>;
    surfaces: ConversationRefactorSurfaceEvidence[];
    focusedTestSuites: string[];
    browserProofSpecs: string[];
    releaseArtifacts: string[];
  };
  inventory: {
    canonicalTablesInspected: string[];
    existingDurableState: string[];
    transcriptOwnedState: string[];
    missingDurableState: string[];
    reusableInfrastructure: string[];
  };
  review: {
    blockingReasons: string[];
    warnings: string[];
    rejectedApproaches: string[];
  };
  steps: ConversationRefactorQaStepResult[];
}

export interface WriteConversationRefactorEvidenceOptions {
  releaseDir?: string;
  steps: ConversationRefactorQaStepResult[];
  warnings?: string[];
  blockingReasons?: string[];
  now?: Date;
}

export const CONVERSATION_REFACTOR_PHASE_00_FOCUSED_TEST_SUITES = [
  "tests/conversation/phase-00-baseline-evidence.test.ts",
  "src/hooks/chat/chatConversationApi.test.ts",
  "src/lib/jobs/job-read-model.test.ts",
  "src/lib/media/browser-runtime/job-snapshots.test.ts",
  "src/lib/media/media-asset-projection.test.ts",
  "src/lib/prompts/prompt-provenance.test.ts",
  "tests/chat/conversation-portability.test.ts",
  "tests/deferred-job-repository.test.ts",
  "tests/search/hybrid-search-engine.test.ts",
] as const;

export const CONVERSATION_REFACTOR_PHASE_01_FOCUSED_TEST_SUITES = [
  "tests/conversation/phase-01-canonical-domain-contracts.test.ts",
] as const;

export const CONVERSATION_REFACTOR_PHASE_02_FOCUSED_TEST_SUITES = [
  "src/core/platform/conversation-workspace/WorkspaceSnapshotProjector.test.ts",
  "src/core/platform/conversation-workspace/WorkspaceSnapshotReader.test.ts",
  "tests/conversation/phase-02-workspace-snapshot-projection.test.ts",
] as const;

export const CONVERSATION_REFACTOR_PHASE_02A_FOCUSED_TEST_SUITES = [
  "src/core/platform/business-workflow/BusinessWorkflowContextProjector.test.ts",
  "src/core/platform/business-workflow/BusinessWorkflowContextReader.test.ts",
  "tests/conversation/phase-02a-business-workflow-context-projection.test.ts",
] as const;

export const CONVERSATION_REFACTOR_PHASE_02B_FOCUSED_TEST_SUITES = [
  "src/core/platform/operator-transition/TrustDistributionProjector.test.ts",
  "src/core/platform/operator-transition/OperatorTransitionProjector.test.ts",
  "src/core/platform/operator-transition/TrustDistributionReader.test.ts",
  "src/core/platform/operator-transition/OperatorTransitionReader.test.ts",
  "tests/conversation/phase-02b-operator-transition-and-trust-distribution-projection.test.ts",
] as const;

export const CONVERSATION_REFACTOR_PHASE_03_FOCUSED_TEST_SUITES = [
  "src/core/platform/conversation-restore/WorkspaceRestoreProjector.test.ts",
  "src/core/platform/conversation-restore/WorkspaceRestoreReader.test.ts",
  "src/app/api/workspace/restore/route.test.ts",
  "src/hooks/chat/useChatJobEvents.test.tsx",
  "src/hooks/useGlobalChat.test.tsx",
] as const;

export const CONVERSATION_REFACTOR_FOCUSED_TEST_SUITES = [
  ...CONVERSATION_REFACTOR_PHASE_00_FOCUSED_TEST_SUITES,
  ...CONVERSATION_REFACTOR_PHASE_01_FOCUSED_TEST_SUITES,
  ...CONVERSATION_REFACTOR_PHASE_02_FOCUSED_TEST_SUITES,
  ...CONVERSATION_REFACTOR_PHASE_02A_FOCUSED_TEST_SUITES,
  ...CONVERSATION_REFACTOR_PHASE_02B_FOCUSED_TEST_SUITES,
  ...CONVERSATION_REFACTOR_PHASE_03_FOCUSED_TEST_SUITES,
] as const;

export const CONVERSATION_REFACTOR_PHASE_00_BROWSER_PROOF_SPECS = [
  "tests/browser-ui/conversation-portability.spec.ts",
  "tests/browser-ui/jobs-page.spec.ts",
  "tests/browser-ui/deferred-job-worker-live.spec.ts",
  "tests/browser-ui/homepage-restore-idempotency.spec.ts",
] as const;

export const CONVERSATION_REFACTOR_PHASE_00_RELEASE_ARTIFACTS = [
  "release/conversation-refactor-evidence.json",
  "docs/_refactor/conversation/phase-00-baseline-evidence.md",
] as const;

export const CONVERSATION_REFACTOR_CANONICAL_TABLES = [
  "conversations",
  "messages",
  "job_requests",
  "job_events",
  "user_files",
  "embeddings",
  "system_prompts",
  "prompt_provenance_records",
  "conversation_events",
  "referrals",
  "referral_events",
] as const;

export const CONVERSATION_REFACTOR_PHASE_00_SURFACES: ConversationRefactorSurfaceEvidence[] = [
  {
    id: "homepage-active-restore",
    surface: "Homepage load and active conversation restore",
    status: "misleading",
    currentAuthority: "ChatSurface plus /api/conversations/active return the active conversation and full message list.",
    files: [
      "src/app/page.tsx",
      "src/app/api/conversations/active/route.ts",
      "src/hooks/chat/useChatRestore.ts",
      "src/hooks/chat/chatConversationApi.ts",
    ],
    tables: ["conversations", "messages"],
    preservedBehavior: [
      "Signed-in homepage resolves shell navigation before rendering embedded chat.",
      "Active restore can return the latest active conversation and messages.",
    ],
    negativeCases: [
      "Restore payload is not yet a workspace read model and can make transcript content look operational.",
      "Long-lived continuity is not proven by same-turn chat API tests alone.",
    ],
    nextProof: "Phase 03 must prove repeated homepage restore does not execute historical tool parts or create new jobs.",
  },
  {
    id: "message-part-rendering",
    surface: "Message-part persistence and restore rendering",
    status: "partial",
    currentAuthority: "messages.parts stores transcript parts as JSON and the client replaces chat state from restored messages.",
    files: [
      "src/adapters/MessageDataMapper.ts",
      "src/frameworks/ui/MessageList.tsx",
      "src/frameworks/ui/chat/ToolPluginPartRenderer.tsx",
      "src/hooks/chat/useChatRestore.ts",
    ],
    tables: ["messages"],
    preservedBehavior: [
      "Message parts round-trip through durable storage.",
      "The transcript remains renderable after reload.",
    ],
    negativeCases: [
      "Message parts still carry too much operational-looking state for browser runtime recovery.",
    ],
    nextProof: "Phase 03 and Phase 10 must prove old executable-looking parts render as history only.",
  },
  {
    id: "browser-runtime-recovery",
    surface: "Browser runtime candidate discovery and recovery",
    status: "guarded",
    currentAuthority: "Browser runtime candidates are inferred from tool_call/tool_result message parts and guarded by job_status snapshots.",
    files: [
      "src/lib/media/browser-runtime/job-snapshots.ts",
      "src/hooks/chat/useBrowserCapabilityRuntime.ts",
      "src/hooks/chat/browserRuntimeJobStore.ts",
    ],
    tables: ["messages", "user_files"],
    preservedBehavior: [
      "Browser runtime skips deferred job payloads.",
      "Terminal job_status snapshots do not restart browser runtime work.",
      "Durable asset fields can turn failed or canceled browser snapshots into succeeded render state.",
    ],
    negativeCases: [
      "Candidate discovery is still transcript-derived and should become a disposable adapter over canonical restore state.",
    ],
    nextProof: "Phase 03 must reconcile stale browser runtime cache from durable restore state instead of trusting cache or transcript alone.",
  },
  {
    id: "job-ledger-and-sse",
    surface: "Job queue tables, job events, job read models, and SSE reconciliation",
    status: "partial",
    currentAuthority: "job_requests and job_events own durable deferred execution status; active jobs are queued or running only.",
    files: [
      "src/adapters/JobQueueDataMapper.ts",
      "src/lib/jobs/job-read-model.ts",
      "src/lib/jobs/job-event-stream.ts",
      "src/app/api/jobs/events/route.ts",
      "src/components/jobs/useJobsEventStream.ts",
    ],
    tables: ["job_requests", "job_events"],
    preservedBehavior: [
      "Queued and running jobs are active work.",
      "Succeeded, failed, canceled, and dead-letter jobs are terminal or attention states, not active work.",
      "Active dedupe looks at durable queued/running jobs by conversation and dedupe key.",
    ],
    negativeCases: [
      "Missed SSE events need explicit restore reconciliation proof.",
      "Historical materialization reuse is not yet a first-class registry.",
    ],
    nextProof: "Phase 04 must prove active-equivalent and successful-materialization decisions before enqueueing duplicate work.",
  },
  {
    id: "asset-storage-and-lineage",
    surface: "User-file storage, media asset projection, and upload cleanup",
    status: "partial",
    currentAuthority: "user_files plus metadata_json own durable generated/uploaded file records; media projection normalizes source and retention metadata.",
    files: [
      "src/adapters/UserFileDataMapper.ts",
      "src/lib/media/media-asset-projection.ts",
      "src/app/api/chat/uploads/route.ts",
      "src/lib/user-files.ts",
      "scripts/reap-chat-uploads.ts",
    ],
    tables: ["user_files"],
    preservedBehavior: [
      "Generated and uploaded files persist outside transcript messages.",
      "Storage accounting can group by retention class and source from metadata.",
    ],
    negativeCases: [
      "Asset catalog and lineage are not yet a canonical query surface for restore.",
    ],
    nextProof: "Phase 05 must prove reusable assets are visible without scanning message parts.",
  },
  {
    id: "conversation-search-indexing",
    surface: "Conversation embedding and search indexing",
    status: "partial",
    currentAuthority: "Archived conversation text is embedded into the vector store under a user/conversation source id.",
    files: [
      "src/lib/chat/embed-conversation.ts",
      "src/core/search/ConversationChunker.ts",
      "src/adapters/SQLiteVectorStore.ts",
      "src/core/use-cases/tools/search-my-conversations.tool.ts",
    ],
    tables: ["embeddings", "conversations", "messages"],
    preservedBehavior: [
      "Conversation search indexes transcript content for recall.",
      "Ownership repair can delete the previous source id and re-index under the current user.",
    ],
    negativeCases: [
      "Embeddings are recall infrastructure, not relationship memory.",
    ],
    nextProof: "Phase 07 must split relationship memory retrieval, transcript recall, corpus grounding, and product discovery.",
  },
  {
    id: "prompt-runtime-provenance",
    surface: "Prompt runtime provenance and prompt control plane",
    status: "partial",
    currentAuthority: "Prompt runtime returns effective hashes, slot refs, sections, warnings, and provenance records for chat surfaces.",
    files: [
      "src/lib/chat/prompt-runtime.ts",
      "src/lib/prompts/prompt-provenance-store.ts",
      "src/adapters/PromptProvenanceDataMapper.ts",
      "src/core/use-cases/SystemPromptBuilder.ts",
    ],
    tables: ["system_prompts", "prompt_provenance_records"],
    preservedBehavior: [
      "Prompt assembly can identify fallback, missing, and override states.",
      "Trusted referral context enters prompt assembly as server-owned context.",
    ],
    negativeCases: [
      "Durable decisions such as memory updates and materialization reuse do not yet share one PromptBinding contract.",
    ],
    nextProof: "Phase 08 must record prompt bindings at durable decision points instead of relying only on chat-turn provenance.",
  },
  {
    id: "identity-migration",
    surface: "Anonymous session resolution and migration",
    status: "partial",
    currentAuthority: "Anonymous-to-authenticated migration transfers conversations, jobs, referral linkage, and search ownership repair through auth-side workflow.",
    files: [
      "src/lib/chat/resolve-user.ts",
      "src/lib/chat/migrate-anonymous-conversations.ts",
      "tests/chat/conversation-portability.test.ts",
      "tests/jobs/ownership-migration.test.ts",
      "tests/browser-ui/conversation-portability.spec.ts",
    ],
    tables: ["conversations", "messages", "job_requests", "job_events", "embeddings", "referrals", "referral_events"],
    preservedBehavior: [
      "Anonymous conversations can become authenticated conversations.",
      "Referral linkage is treated as part of migration continuity.",
    ],
    negativeCases: [
      "User-file, materialization, memory, and prompt-binding ownership repair are not yet first-class migration stages.",
      "Identity migration is not yet modeled as a canonical domain workflow with status projection and repair state.",
    ],
    nextProof: "Phase 09 must prove idempotent repair and deletion coverage for every canonical continuity surface.",
  },
];

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function buildCoverageAccounting(
  surfaces: ConversationRefactorSurfaceEvidence[],
): Record<ConversationRefactorCoverageStatus, string[]> {
  return {
    covered: surfaces.filter((surface) => surface.status === "covered").map((surface) => surface.id),
    partial: surfaces.filter((surface) => surface.status === "partial").map((surface) => surface.id),
    missing: surfaces.filter((surface) => surface.status === "missing").map((surface) => surface.id),
    misleading: surfaces.filter((surface) => surface.status === "misleading").map((surface) => surface.id),
    guarded: surfaces.filter((surface) => surface.status === "guarded").map((surface) => surface.id),
  };
}

export function createConversationRefactorPhase00Evidence(options: {
  steps?: ConversationRefactorQaStepResult[];
  warnings?: string[];
  blockingReasons?: string[];
  now?: Date;
} = {}): ConversationRefactorPhase00Evidence {
  const surfaces = CONVERSATION_REFACTOR_PHASE_00_SURFACES.map((surface) => ({
    ...surface,
    files: [...surface.files],
    tables: [...surface.tables],
    preservedBehavior: [...surface.preservedBehavior],
    negativeCases: [...surface.negativeCases],
  }));
  const failedStep = options.steps?.find((step) => step.status === "failed");
  const blockingReasons = uniqueNonEmpty([
    ...(options.blockingReasons ?? []),
    ...(failedStep ? [`QA step failed: ${failedStep.label}.`] : []),
  ]);

  return {
    version: 1,
    generatedAt: (options.now ?? new Date()).toISOString(),
    bundleId: "conversation-refactor-phase-00-02b-operator-transition-and-trust-distribution",
    phase: "00-02B",
    status: blockingReasons.length > 0 ? "failed" : "passed",
    coverage: {
      accounting: buildCoverageAccounting(surfaces),
      surfaces,
      focusedTestSuites: [...CONVERSATION_REFACTOR_FOCUSED_TEST_SUITES],
      browserProofSpecs: [...CONVERSATION_REFACTOR_PHASE_00_BROWSER_PROOF_SPECS],
      releaseArtifacts: [...CONVERSATION_REFACTOR_PHASE_00_RELEASE_ARTIFACTS],
    },
    inventory: {
      canonicalTablesInspected: [...CONVERSATION_REFACTOR_CANONICAL_TABLES],
      existingDurableState: [
        "conversations and messages preserve the active transcript.",
        "job_requests and job_events preserve deferred work status and renderable job history.",
        "user_files preserves generated and uploaded media outside the transcript.",
        "embeddings preserves transcript recall indexes for archived conversation search.",
        "prompt_provenance_records preserves chat-turn prompt hashes, slot refs, sections, and replay context.",
        "referrals and referral_events preserve trusted attribution and milestone history.",
      ],
      transcriptOwnedState: [
        "Homepage restore still initializes chat from conversation messages rather than a workspace read model.",
        "Browser runtime recovery still discovers some candidates from tool_call/tool_result message parts.",
        "Reusable asset visibility can still depend on historical tool cards until an asset catalog query owns restore.",
      ],
      missingDurableState: [
        "WorkspaceSnapshot projection.",
        "BusinessWorkflowContext projection.",
        "OperatorTransitionProfile projection.",
        "TrustDistributionContext projection.",
        "MaterializationRecord registry for successful reusable work.",
        "RelationshipMemory projection with evidence refs.",
        "PromptBinding contract for durable non-chat decisions.",
        "IdentityMigrationEvent and migration status projection.",
      ],
      reusableInfrastructure: [
        "Vitest deterministic suites under src/ and tests/.",
        "Playwright browser suites under tests/browser-ui/.",
        "Release evidence writers under src/lib/evals/ and scripts/run-*-qa.ts.",
        "Runtime integrity QA pattern for focused suites plus generated release evidence.",
        "Phase 01 canonical contract suite proves new domain contracts and ports stay inside clean architecture boundaries.",
        "Phase 02A business workflow suites prove compact source-owned workflow projection over durable records.",
        "Phase 02B operator-transition and trust-distribution suites prove share readiness, follow-up pressure, admin review pressure, and clean projection boundaries over profile and referral analytics sources.",
      ],
    },
    review: {
      blockingReasons,
      warnings: uniqueNonEmpty(options.warnings ?? []),
      rejectedApproaches: [
        "Do not patch only useChatRestore to hide old tool parts.",
        "Do not suppress old browser-runtime candidates without durable restore state.",
        "Do not treat embeddings as relationship memory.",
        "Do not use browser session storage as authoritative recovery truth.",
        "Do not rebuild the job ledger before proving the current durable job model and gaps.",
      ],
    },
    steps: options.steps ?? [],
  };
}

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function readConversationRefactorEvidenceFromFile(filePath: string): ConversationRefactorPhase00Evidence | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ConversationRefactorPhase00Evidence;
}

export function writeConversationRefactorEvidenceArtifact(options: WriteConversationRefactorEvidenceOptions): {
  artifactPath: string;
  evidence: ConversationRefactorPhase00Evidence;
} {
  const releaseDir = options.releaseDir ?? path.join(process.cwd(), "release");
  const artifactPath = path.join(releaseDir, "conversation-refactor-evidence.json");
  const evidence = createConversationRefactorPhase00Evidence(options);

  fs.mkdirSync(releaseDir, { recursive: true });
  fs.writeFileSync(artifactPath, serializeJson(evidence), "utf8");

  return {
    artifactPath,
    evidence,
  };
}
