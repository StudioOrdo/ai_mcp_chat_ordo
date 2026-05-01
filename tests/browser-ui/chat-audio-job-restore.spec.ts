import { expect, test, type Page, type Route } from "@playwright/test";

test.describe.configure({ timeout: 45_000 });

const conversationId = "conv_audio_restore_keith";
const audioAssetId = "uf_audio_keith_restore_1";
const completedAt = "2026-04-30T22:00:00.000Z";

function completedAudioSnapshot() {
  return {
    jobId: "job_audio_restore_keith_1",
    conversationId,
    userId: "usr_keith_firehose360",
    toolName: "generate_audio",
    label: "Generate Audio",
    title: "Keith regression audio",
    status: "succeeded",
    sequence: 42,
    progressPercent: 100,
    progressLabel: "Audio ready",
    summary: "Audio generated successfully.",
    createdAt: "2026-04-30T21:59:00.000Z",
    startedAt: "2026-04-30T21:59:01.000Z",
    completedAt,
    updatedAt: completedAt,
    origin: {
      originMessageId: "msg_audio_restore_assistant",
      toolInvocationId: "toolu_audio_restore_1",
      fallback: "explicit_origin",
    },
    inputSnapshot: {
      title: "Keith regression audio",
      text: "Make this generated audio persist after restore.",
    },
    resultPayload: {
      action: "generate_audio",
      title: "Keith regression audio",
      text: "Make this generated audio persist after restore.",
      assetId: audioAssetId,
      provider: "user-file-cache",
      generationStatus: "cached_asset",
      estimatedDurationSeconds: 8,
      estimatedGenerationSeconds: 2,
    },
    resultEnvelope: {
      schemaVersion: 1,
      toolName: "generate_audio",
      family: "artifact",
      cardKind: "artifact_viewer",
      executionMode: "deferred",
      summary: {
        title: "Keith regression audio",
        message: "Audio generated successfully.",
        statusLine: "audio_ready",
      },
      inputSnapshot: {
        title: "Keith regression audio",
        text: "Make this generated audio persist after restore.",
      },
      artifacts: [
        {
          id: "artifact_audio_restore_keith_1",
          kind: "audio",
          label: "Keith regression audio",
          mimeType: "audio/mpeg",
          assetId: audioAssetId,
          uri: `/api/user-files/${audioAssetId}`,
        },
      ],
      payload: {
        action: "generate_audio",
        title: "Keith regression audio",
        text: "Make this generated audio persist after restore.",
        assetId: audioAssetId,
        provider: "user-file-cache",
        generationStatus: "cached_asset",
        estimatedDurationSeconds: 8,
        estimatedGenerationSeconds: 2,
      },
    },
    artifactRefs: [
      {
        id: "artifact_audio_restore_keith_1",
        kind: "audio",
        label: "Keith regression audio",
        mimeType: "audio/mpeg",
        assetId: audioAssetId,
        uri: `/api/user-files/${audioAssetId}`,
      },
    ],
    materializationRefs: ["mat_audio_restore_keith_1"],
    ownership: {
      userId: "usr_keith_firehose360",
      visibility: "owner",
      initiatorType: "user",
    },
    failure: {
      failureClass: null,
      recoveryMode: null,
      nextRetryAt: null,
      lastCheckpointId: null,
      replayedFromJobId: null,
      supersededByJobId: null,
    },
  };
}

function workspaceRestorePayload() {
  return {
    workspace: {
      id: `workspace:${conversationId}`,
      userId: "usr_keith_firehose360",
      conversationId,
      status: "active",
      title: "Keith audio restore",
      currentObjective: "Verify generated audio restore",
      recommendedNextStep: "Use the restored audio asset",
      openLoops: [],
      activeJobRefs: [],
      importantAssetRefs: [audioAssetId],
      workflowContextRef: null,
      operatorTransitionRef: null,
      trustDistributionRef: null,
      relatedBusinessRefs: [],
      latestMemoryRef: null,
      latestPromptBindingRef: null,
      updatedAt: completedAt,
    },
    activeJobs: [completedAudioSnapshot()],
    attentionNeededJobs: [],
    assets: [],
    workflow: null,
    operatorTransition: null,
    trustDistribution: null,
    memory: null,
    migration: null,
    restoreMeta: {
      schemaVersion: 1,
      restoredAt: completedAt,
      source: "durable_read_model",
    },
    recentTranscript: [
      {
        id: "msg_audio_restore_user",
        conversationId,
        role: "user",
        content: "make audio for this restore regression",
        parts: [],
        createdAt: "2026-04-30T21:58:59.000Z",
        tokenEstimate: 0,
      },
      {
        id: "msg_audio_restore_assistant",
        conversationId,
        role: "assistant",
        content: "The audio job is complete.",
        parts: [
          {
            type: "tool_call",
            name: "generate_audio",
            args: {
              title: "Keith regression audio",
              text: "Make this generated audio persist after restore.",
            },
            toolInvocationId: "toolu_audio_restore_1",
          },
          {
            type: "tool_result",
            name: "generate_audio",
            toolInvocationId: "toolu_audio_restore_1",
            result: {
              action: "generate_audio",
              title: "Direct transcript payload must not render",
              text: "This raw transcript result is historical only.",
              assetId: "uf_audio_direct_transcript_legacy",
              provider: "user-file-cache",
              generationStatus: "cached_asset",
            },
          },
        ],
        createdAt: "2026-04-30T22:00:00.000Z",
        tokenEstimate: 0,
      },
    ],
  };
}

async function stubAudioRestore(page: Page) {
  await page.route("**/api/preferences", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ preferences: [] }),
    });
  });

  await page.route("**/api/referral/visit", async (route: Route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "No referral visit" }),
    });
  });

  await page.route("**/api/workspace/restore**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(workspaceRestorePayload()),
    });
  });

  await page.route("**/api/chat/jobs?**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ jobs: [completedAudioSnapshot()] }),
    });
  });

  await page.route("**/api/chat/events**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
      body: "",
    });
  });

  await page.route(`**/api/user-files/${audioAssetId}`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "audio/mpeg",
      headers: {
        "Content-Length": "4",
        "Accept-Ranges": "bytes",
      },
      body: "ID3\u0000",
    });
  });
}

test("restores one canonical generated-audio card after reload while ignoring raw transcript audio payloads", async ({ page }) => {
  await stubAudioRestore(page);

  await page.goto(`/?conversationId=${conversationId}`);

  const audioRegion = page.getByRole("region", { name: "Generate Audio result" });
  await expect(audioRegion).toHaveCount(1);
  await expect(audioRegion).toContainText("Keith regression audio");
  await expect(audioRegion).toContainText(audioAssetId);
  await expect(page.getByText("Direct transcript payload must not render")).toHaveCount(0);

  await page.reload();

  await expect(audioRegion).toHaveCount(1);
  await expect(audioRegion).toContainText("Keith regression audio");
  await expect(audioRegion).toContainText(audioAssetId);
  await expect(page.getByText("Direct transcript payload must not render")).toHaveCount(0);
});
