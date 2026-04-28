import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  assertVideoLocatorPlayable,
  attachDebugObservers,
  buildMediaInvocationEvidence,
  collectBrowserDiagnostics,
  collectWorkflowStatuses,
  copyUploadFixture,
  createRunDirectory,
  downloadAuthenticatedAsset,
  measureAudioVolume,
  probeMediaFile,
  readMediaLabManifest,
  registerFreshUser,
  writeJson,
} from "./helpers/media-eval";

const ARTIFACT_ROOT = path.join(process.cwd(), "test-results", "media-compose-eval-artifacts");

type MediaLabSetupContext = {
  page: import("@playwright/test").Page;
  runDir: string;
  baseURL: string;
};

async function waitForWorkflowTerminalSuccess(page: import("@playwright/test").Page, workflowKey: string) {
  const statusCard = page.getByTestId(`status-${workflowKey}`);
  await expect(statusCard).toContainText("running", { timeout: 30_000 });
  await expect.poll(async () => {
    return (await statusCard.textContent())?.replace(/\s+/g, " ").trim() ?? "";
  }, { timeout: 240_000 }).toMatch(/succeeded|failed/);

  const statusText = (await statusCard.textContent())?.replace(/\s+/g, " ").trim() ?? "";
  if (statusText.includes("failed")) {
    throw new Error(`${workflowKey} failed in media lab: ${statusText}`);
  }
}

async function runMediaLabScenario(options: {
  page: import("@playwright/test").Page;
  testInfo: import("@playwright/test").TestInfo;
  scenario: string;
  workflowKey: string;
  runButtonName: string;
  artifactKey: string;
  setup?: (context: MediaLabSetupContext) => Promise<Record<string, unknown> | void>;
}) {
  const { page, testInfo, scenario, workflowKey, runButtonName, artifactKey, setup } = options;
  const baseURL = String(testInfo.project.use.baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:34123");
  const { runId, runDir } = createRunDirectory(ARTIFACT_ROOT);
  const debug = attachDebugObservers(page);

  let thrownError: unknown = null;

  try {
    await registerFreshUser(page, {
      displayName: "Media Compose Eval User",
      emailPrefix: "media-compose-eval",
      password: "MediaComposeEval!Pass123",
    });
    await page.goto("/e2e/media-lab");
    await expect(page.getByRole("heading", { name: "Live media workflow lab" })).toBeVisible();

    const browserDiagnostics = await collectBrowserDiagnostics(page);
    writeJson(path.join(runDir, "browser-diagnostics.json"), browserDiagnostics);

    await page.screenshot({ path: path.join(runDir, "01-lab-loaded.png"), fullPage: true });
    const setupSummary = await setup?.({ page, runDir, baseURL }) ?? {};
    await page.screenshot({ path: path.join(runDir, "02-scenario-prepared.png"), fullPage: true });

    await page.getByRole("button", { name: runButtonName }).click();
    await waitForWorkflowTerminalSuccess(page, workflowKey);
    await expect(page.getByTestId(`artifact-link-${artifactKey}`)).toBeVisible({ timeout: 60_000 });

    await page.screenshot({ path: path.join(runDir, "03-workflow-succeeded.png"), fullPage: true });

    const playbackState = await assertVideoLocatorPlayable(page.getByTestId(`artifact-video-${artifactKey}`));
    const manifest = await readMediaLabManifest(page);
    const workflowStatuses = await collectWorkflowStatuses(page);
    const scenarioVideo = manifest.find((entry) => entry.key === artifactKey);
    const invocationEvidence = await buildMediaInvocationEvidence({
      page,
      manifest,
    });

    expect(scenarioVideo).toBeDefined();
    if (!scenarioVideo) {
      throw new Error(`${artifactKey} missing from manifest.`);
    }
    expect(scenarioVideo.note).toBe("browser_wasm");

    const downloadedVideoPath = path.join(runDir, `${artifactKey}.mp4`);
    await downloadAuthenticatedAsset({
      page,
      baseURL,
      uri: scenarioVideo.uri,
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

    const summary = {
      runId,
      baseURL,
      scenario,
      workflowKey,
      artifactKey,
      browserDiagnostics,
      workflowStatuses,
      manifest,
      scenarioVideo,
      invocationEvidence,
      playbackState,
      mediaProbe,
      audioVolume,
      consoleRecords: debug.consoleRecords,
      pageErrors: debug.pageErrors,
      requestFailures: debug.requestFailures,
      responses: debug.responses,
      navigations: debug.navigations,
      downloadedVideoPath,
      screenshots: [
        "01-lab-loaded.png",
        "02-scenario-prepared.png",
        "03-workflow-succeeded.png",
      ],
      ...setupSummary,
    };

    writeJson(path.join(runDir, "debug-summary.json"), summary);
    await testInfo.attach(`${scenario}-summary`, {
      path: path.join(runDir, "debug-summary.json"),
      contentType: "application/json",
    });
  } catch (error) {
    thrownError = error;
    throw error;
  } finally {
    const fallbackManifest = page.isClosed() ? [] : await readMediaLabManifest(page).catch(() => []);
    const fallbackStatuses = page.isClosed() ? [] : await collectWorkflowStatuses(page).catch(() => []);
    const failureScreenshot = path.join(runDir, "final-state.png");

    if (!page.isClosed()) {
      await page.screenshot({ path: failureScreenshot, fullPage: true }).catch(() => undefined);
    }

    writeJson(path.join(runDir, "failure-context.json"), {
      runId,
      baseURL,
      scenario,
      error: thrownError instanceof Error ? thrownError.message : thrownError,
      manifest: fallbackManifest,
      workflowStatuses: fallbackStatuses,
      consoleRecords: debug.consoleRecords,
      pageErrors: debug.pageErrors,
      requestFailures: debug.requestFailures,
      responses: debug.responses,
      navigations: debug.navigations,
      finalScreenshot: fs.existsSync(failureScreenshot) ? failureScreenshot : null,
    });
  }
}

test("compose media eval: generated image plus real TTS yields playable audible video with debug bundle", async ({ page }, testInfo) => {
  test.setTimeout(480_000);

  await runMediaLabScenario({
    page,
    testInfo,
    scenario: "generated-image-plus-real-tts",
    workflowKey: "workflow1",
    runButtonName: "Run Workflow 1",
    artifactKey: "workflow1-video",
  });
});

test("compose media eval: uploaded image plus real TTS yields playable audible video with debug bundle", async ({ page }, testInfo) => {
  test.setTimeout(480_000);

  await runMediaLabScenario({
    page,
    testInfo,
    scenario: "uploaded-image-plus-real-tts",
    workflowKey: "workflow2",
    runButtonName: "Run Workflow 2",
    artifactKey: "workflow2-video",
    setup: async ({ page, runDir }) => {
      const uploadPath = await copyUploadFixture(runDir, "uploaded-image-source.png");
      await page.getByLabel("Upload workflow image").setInputFiles(uploadPath);
      await expect(page.getByTestId("artifact-link-uploaded-image")).toBeVisible({ timeout: 30_000 });

      return { uploadedImageSourcePath: uploadPath };
    },
  });
});

test("compose media eval: uploaded clip concat yields a playable audible combined video with debug bundle", async ({ page }, testInfo) => {
  test.setTimeout(600_000);

  await runMediaLabScenario({
    page,
    testInfo,
    scenario: "uploaded-clip-concat",
    workflowKey: "workflow6",
    runButtonName: "Run Workflow 6",
    artifactKey: "workflow6-video",
    setup: async ({ page, runDir, baseURL }) => {
      const uploadPath = await copyUploadFixture(runDir, "workflow6-upload-image-source.png");
      await page.getByLabel("Upload workflow image").setInputFiles(uploadPath);
      await expect(page.getByTestId("artifact-link-uploaded-image")).toBeVisible({ timeout: 30_000 });

      await page.getByRole("button", { name: "Run Workflow 1" }).click();
      await waitForWorkflowTerminalSuccess(page, "workflow1");
      await page.getByRole("button", { name: "Run Workflow 2" }).click();
      await waitForWorkflowTerminalSuccess(page, "workflow2");

      const manifest = await readMediaLabManifest(page);
      const workflow1Video = manifest.find((entry) => entry.key === "workflow1-video");
      const workflow2Video = manifest.find((entry) => entry.key === "workflow2-video");

      expect(workflow1Video).toBeDefined();
      expect(workflow2Video).toBeDefined();
      if (!workflow1Video || !workflow2Video) {
        throw new Error("Workflow 1 and workflow 2 videos must exist before workflow 6 can upload concat fixtures.");
      }

      const firstVideoPath = path.join(runDir, "workflow6-upload-source-1.mp4");
      const secondVideoPath = path.join(runDir, "workflow6-upload-source-2.mp4");
      await downloadAuthenticatedAsset({
        page,
        baseURL,
        uri: workflow1Video.uri,
        destinationPath: firstVideoPath,
      });
      await downloadAuthenticatedAsset({
        page,
        baseURL,
        uri: workflow2Video.uri,
        destinationPath: secondVideoPath,
      });

      await page.getByLabel("Upload workflow videos").setInputFiles([firstVideoPath, secondVideoPath]);
      await expect(page.getByTestId("uploaded-video-names")).toContainText("workflow6-upload-source-1.mp4");
      await expect(page.getByTestId("uploaded-video-names")).toContainText("workflow6-upload-source-2.mp4");

      return {
        uploadedImageSourcePath: uploadPath,
        sourceVideoArtifacts: [workflow1Video, workflow2Video],
        uploadedVideoSources: [firstVideoPath, secondVideoPath],
      };
    },
  });
});