import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  assertVideoLocatorPlayable,
  attachDebugObservers,
  buildMediaInvocationEvidence,
  collectBrowserDiagnostics,
  copyUploadFixture,
  createRunDirectory,
  downloadAuthenticatedAsset,
  fetchAuthenticatedJson,
  measureAudioVolume,
  probeMediaFile,
  registerFreshUser,
  writeJson,
} from "./helpers/media-eval";

const ARTIFACT_ROOT = path.join(process.cwd(), "test-results", "media-compose-planner-eval-artifacts");

type ConversationMessage = {
  role?: string;
  parts?: unknown[];
};

type ActiveConversationResponse = {
  conversation?: {
    id?: string;
    lastToolUsed?: string | null;
  };
  messages?: ConversationMessage[];
};

type PersistedPlanSnapshot = {
  activeConversation: ActiveConversationResponse;
  singleBeatPlan: Record<string, unknown>;
};

function createNarrationAudioFixture(destinationPath: string): string {
  const sampleRate = 16_000;
  const durationSeconds = 1.2;
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const amplitude = 0.25;
  const frequency = 440;
  const bytesPerSample = 2;
  const dataSize = totalSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex += 1) {
    const time = sampleIndex / sampleRate;
    const sample = Math.round(Math.sin(2 * Math.PI * frequency * time) * 32767 * amplitude);
    buffer.writeInt16LE(sample, 44 + (sampleIndex * bytesPerSample));
  }

  fs.writeFileSync(destinationPath, buffer);
  return destinationPath;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectPlanLikeObjects(value: unknown, plans: Array<Record<string, unknown>> = []): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectPlanLikeObjects(entry, plans);
    }
    return plans;
  }

  if (!isRecord(value)) {
    return plans;
  }

  if (Array.isArray(value.visualClips) && Array.isArray(value.audioClips)) {
    plans.push(value);
  }

  for (const nested of Object.values(value)) {
    collectPlanLikeObjects(nested, plans);
  }

  return plans;
}

function extractSingleBeatPlan(activeConversation: ActiveConversationResponse): Record<string, unknown> | null {
  const planLikeObjects = collectPlanLikeObjects(activeConversation.messages ?? []);
  return planLikeObjects.find((candidate) => candidate.visualClips instanceof Array && candidate.visualClips.length === 1
    && candidate.audioClips instanceof Array && candidate.audioClips.length === 1) ?? null;
}

test("planner eval: attached image prompt yields a real composed video with debug bundle", async ({ page }, testInfo) => {
  test.setTimeout(600_000);

  const baseURL = String(testInfo.project.use.baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:34123");
  const { runId, runDir } = createRunDirectory(ARTIFACT_ROOT);
  const debug = attachDebugObservers(page);
  const prompt = [
    "Create a short acceptance-test video from the attached image and attached narration audio file.",
    "Use exactly one still image beat from the image attachment and exactly one narration track from the audio attachment.",
    "Do not generate new audio.",
    "Finish the composition and return the video.",
  ].join(" ");

  let thrownError: unknown = null;

  try {
    await registerFreshUser(page, {
      displayName: "Media Planner Eval User",
      emailPrefix: "media-planner-eval",
      password: "MediaPlannerEval!Pass123",
    });

    await expect(page.getByLabel("Message")).toBeVisible();

    const browserDiagnostics = await collectBrowserDiagnostics(page);
    writeJson(path.join(runDir, "browser-diagnostics.json"), browserDiagnostics);
    await page.screenshot({ path: path.join(runDir, "01-chat-home-loaded.png"), fullPage: true });

    const visibleComposer = page
      .locator('[data-chat-composer-form="true"]')
      .filter({ has: page.locator('textarea[aria-label="Message"]:visible') })
      .first();

    const imageUploadPath = await copyUploadFixture(runDir, "planner-attached-image.png");
    const audioUploadPath = createNarrationAudioFixture(path.join(runDir, "planner-attached-narration.wav"));
    await visibleComposer.locator('input[type="file"]').setInputFiles([imageUploadPath, audioUploadPath]);
    await expect(page.getByText("planner-attached-image.png")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("planner-attached-narration.wav")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(runDir, "02-image-attached.png"), fullPage: true });

    const composer = page.getByLabel("Message");
    await composer.fill(prompt);
    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(page.getByText(prompt)).toBeVisible({ timeout: 30_000 });

    const mediaResult = page.locator('[aria-label="Media render result"]');
    const mediaFailure = page.locator('[aria-label="Media composition failed"]');
    await expect.poll(async () => {
      if (await mediaFailure.count() > 0 && await mediaFailure.first().isVisible().catch(() => false)) {
        return "failed";
      }

      if (await mediaResult.locator("video").count() > 0 && await mediaResult.first().isVisible().catch(() => false)) {
        return "video";
      }

      if (await mediaResult.count() > 0 && await mediaResult.first().isVisible().catch(() => false)) {
        return "card";
      }

      return "none";
    }, { timeout: 420_000 }).toMatch(/video|failed/);

    if (await mediaFailure.count() > 0 && await mediaFailure.first().isVisible().catch(() => false)) {
      throw new Error(`Planner-driven media composition failed: ${(await mediaFailure.first().textContent())?.replace(/\s+/g, " ").trim() ?? "unknown failure"}`);
    }

    const mediaCard = mediaResult.first();
    await expect(mediaCard).toBeVisible({ timeout: 60_000 });
    const video = mediaCard.locator("video").first();
    await expect(video).toBeVisible({ timeout: 120_000 });
    await page.screenshot({ path: path.join(runDir, "03-media-card-visible.png"), fullPage: true });

    const playbackState = await assertVideoLocatorPlayable(video);
    const videoSrc = await video.getAttribute("src");
    expect(videoSrc).toBeTruthy();
    if (!videoSrc) {
      throw new Error("Planner eval media card rendered without a video src.");
    }

    await expect.poll(async () => await page.getByRole("button", { name: "Stop generation" }).count(), {
      timeout: 120_000,
    }).toBe(0);

    let persistedPlanSnapshot: PersistedPlanSnapshot | null = null;
    await expect.poll(async () => {
      const activeConversation = await fetchAuthenticatedJson<ActiveConversationResponse>({
        page,
        baseURL,
        uri: "/api/conversations/active",
      });
      const singleBeatPlan = extractSingleBeatPlan(activeConversation);

      if (activeConversation.conversation?.lastToolUsed !== "compose_media" || !singleBeatPlan) {
        return null;
      }

      persistedPlanSnapshot = {
        activeConversation,
        singleBeatPlan,
      };
      return "ready";
    }, {
      timeout: 120_000,
      intervals: [1_000, 2_000, 5_000],
    }).toBe("ready");

    expect(persistedPlanSnapshot).not.toBeNull();
    const { activeConversation, singleBeatPlan } = persistedPlanSnapshot as unknown as PersistedPlanSnapshot;

    const downloadedVideoPath = path.join(runDir, "planner-video.mp4");
    await downloadAuthenticatedAsset({
      page,
      baseURL,
      uri: videoSrc,
      destinationPath: downloadedVideoPath,
    });

    const mediaProbe = probeMediaFile(downloadedVideoPath);
    const audioVolume = measureAudioVolume(downloadedVideoPath);
    const videoStreams = mediaProbe.streams?.filter((stream) => stream.codec_type === "video") ?? [];
    const audioStreams = mediaProbe.streams?.filter((stream) => stream.codec_type === "audio") ?? [];

    expect(videoStreams.length).toBeGreaterThan(0);
    expect(audioStreams.length).toBeGreaterThan(0);
    expect(audioVolume.maxVolume).not.toBeNull();
    expect(audioVolume.maxVolume).not.toBe("-inf");
    expect(playbackState.readyState).toBeGreaterThanOrEqual(2);
    expect(playbackState.currentTime).toBeGreaterThan(0.1);
    expect(playbackState.duration).toBeGreaterThan(0.5);
    expect(debug.responses.some((response) => response.url.endsWith("/api/chat/jobs") && response.method === "POST")).toBe(false);
    const invocationEvidence = await buildMediaInvocationEvidence({
      page,
      conversationId: activeConversation.conversation?.id ?? null,
      messages: activeConversation.messages ?? [],
    });

    const summary = {
      runId,
      baseURL,
      scenario: "planner-attached-image-and-audio-to-composed-video",
      prompt,
      browserDiagnostics,
      videoSrc,
      playbackState,
      mediaCardText: (await mediaCard.textContent())?.replace(/\s+/g, " ").trim() ?? null,
      activeConversationId: activeConversation.conversation?.id ?? null,
      activeConversationLastToolUsed: activeConversation.conversation?.lastToolUsed ?? null,
      invocationEvidence,
      singleBeatPlan,
      mediaProbe,
      audioVolume,
      consoleRecords: debug.consoleRecords,
      pageErrors: debug.pageErrors,
      requestFailures: debug.requestFailures,
      responses: debug.responses,
      navigations: debug.navigations,
      downloadedVideoPath,
      screenshots: [
        "01-chat-home-loaded.png",
        "02-image-attached.png",
        "03-media-card-visible.png",
      ],
    };

    writeJson(path.join(runDir, "debug-summary.json"), summary);
    writeJson(path.join(runDir, "conversation-snapshot.json"), activeConversation);

    await testInfo.attach("media-compose-planner-eval-summary", {
      path: path.join(runDir, "debug-summary.json"),
      contentType: "application/json",
    });
  } catch (error) {
    thrownError = error;
    throw error;
  } finally {
    const failureScreenshot = path.join(runDir, "final-state.png");
    if (!page.isClosed()) {
      await page.screenshot({ path: failureScreenshot, fullPage: true }).catch(() => undefined);
    }

    writeJson(path.join(runDir, "failure-context.json"), {
      runId,
      baseURL,
      prompt,
      error: thrownError instanceof Error ? thrownError.message : thrownError,
      consoleRecords: debug.consoleRecords,
      pageErrors: debug.pageErrors,
      requestFailures: debug.requestFailures,
      responses: debug.responses,
      navigations: debug.navigations,
      finalScreenshot: fs.existsSync(failureScreenshot) ? failureScreenshot : null,
    });
  }
});