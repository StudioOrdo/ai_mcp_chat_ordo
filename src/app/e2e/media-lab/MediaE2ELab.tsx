"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MermaidRenderer } from "@/components/MermaidRenderer";
import { GraphRenderer } from "@/components/GraphRenderer";
import { FfmpegBrowserExecutor } from "@/lib/media/browser-runtime/ffmpeg-browser-executor";
import type { MediaCompositionPlan } from "@/core/entities/media-composition";
import { resolveGenerateGraphPayload } from "@/core/use-cases/tools/graph-payload";

type ArtifactEntry = {
  key: string;
  label: string;
  kind: "image" | "audio" | "video";
  assetId: string;
  uri: string;
  mimeType?: string;
  note?: string;
};

type WorkflowStatus = "idle" | "running" | "succeeded" | "failed";

type WorkflowState = {
  status: WorkflowStatus;
  error?: string;
};

type UploadedVideoEntry = {
  key: string;
  label: string;
  assetId: string;
};

type HarnessWindowApi = {
  getManifest: () => ArtifactEntry[];
};

declare global {
  interface Window {
    ordoMediaE2E?: HarnessWindowApi;
  }
}

const chartCode = [
  "flowchart LR",
  "  A[Inbound inquiry] --> B{Qualified?}",
  "  B -->|Yes| C[Schedule consult]",
  "  B -->|No| D[Send nurture note]",
  "  C --> E[Proposal sent]",
].join("\n");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rasterizeSvgToPngBlob(svgElement: SVGSVGElement): Promise<Blob> {
  const rect = svgElement.getBoundingClientRect();
  const width = Math.max(Math.ceil(rect.width), 1200);
  const height = Math.max(Math.ceil(rect.height), 700);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable.");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  let svgData = new XMLSerializer().serializeToString(svgElement);
  if (!svgData.includes("http://www.w3.org/2000/svg")) {
    svgData = svgData.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const image = new Image();
  const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => {
      ctx.drawImage(image, 0, 0, width, height);
      resolve();
    };
    image.onerror = () => reject(new Error("Unable to load serialized SVG."));
    image.src = dataUrl;
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    throw new Error("PNG conversion failed.");
  }

  return blob;
}

async function uploadBlob(blob: Blob, fileName: string): Promise<ArtifactEntry> {
  const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
  const formData = new FormData();
  formData.append("files", file);

  const response = await fetch("/api/chat/uploads", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `Upload failed (${response.status}).`);
  }

  const payload = await response.json() as {
    attachments?: Array<{
      assetId: string;
      mimeType: string;
    }>;
  };
  const uploaded = payload.attachments?.[0];

  if (!uploaded?.assetId) {
    throw new Error("Upload completed without an asset id.");
  }

  return {
    key: uploaded.assetId,
    label: fileName,
    kind: blob.type.startsWith("audio/") ? "audio" : blob.type.startsWith("video/") ? "video" : "image",
    assetId: uploaded.assetId,
    uri: `/api/user-files/${uploaded.assetId}`,
    mimeType: uploaded.mimeType,
  };
}

async function composeRemotely(plan: MediaCompositionPlan): Promise<ArtifactEntry> {
  const response = await fetch("/api/e2e/media/compose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `Remote media compose failed (${response.status}).`);
  }

  const payload = await response.json() as {
    assetId: string;
    uri: string;
    mimeType?: string;
    route?: string;
  };

  if (!payload.assetId || !payload.uri) {
    throw new Error("Remote media compose completed without an artifact.");
  }

  return {
    key: payload.assetId,
    label: payload.assetId,
    kind: "video",
    assetId: payload.assetId,
    uri: payload.uri,
    mimeType: payload.mimeType,
    note: typeof payload.route === "string" ? payload.route : undefined,
  };
}

export function MediaE2ELab() {
  const [artifacts, setArtifacts] = useState<Record<string, ArtifactEntry>>({});
  const [workflows, setWorkflows] = useState<Record<string, WorkflowState>>({
    workflow1: { status: "idle" },
    workflow2: { status: "idle" },
    workflow3: { status: "idle" },
    workflow4: { status: "idle" },
    workflow5: { status: "idle" },
    workflow6: { status: "idle" },
  });
  const [generatedImagePrompt, setGeneratedImagePrompt] = useState("Professional editorial portrait of an operator at a desk with multiple screens, warm daylight, documentary realism");
  const [uploadedImageName, setUploadedImageName] = useState<string | null>(null);
  const [uploadedVideoNames, setUploadedVideoNames] = useState<string[]>([]);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  const graphPayload = useMemo(
    () => resolveGenerateGraphPayload({
      title: "Qualified leads by week",
      caption: "Synthetic acceptance-harness dataset",
      summary: "Qualified leads trend upward across the evaluation window.",
      data: {
        rows: [
          { week: "2026-03-01", qualified: 4 },
          { week: "2026-03-08", qualified: 7 },
          { week: "2026-03-15", qualified: 9 },
          { week: "2026-03-22", qualified: 12 },
        ],
      },
      spec: {
        graphType: "line",
        x: { field: "week", type: "temporal", title: "Week" },
        y: { field: "qualified", type: "quantitative", title: "Qualified leads" },
      },
    }),
    [],
  );

  const manifest = useMemo(() => Object.values(artifacts), [artifacts]);

  useEffect(() => {
    window.ordoMediaE2E = {
      getManifest: () => manifest,
    };

    return () => {
      delete window.ordoMediaE2E;
    };
  }, [manifest]);

  const setWorkflowState = (key: string, next: WorkflowState) => {
    setWorkflows((current) => ({ ...current, [key]: next }));
  };

  const upsertArtifact = (key: string, artifact: ArtifactEntry) => {
    setArtifacts((current) => ({ ...current, [key]: artifact }));
  };

  const generateImage = async () => {
    const response = await fetch("/api/e2e/media/generated-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: generatedImagePrompt,
        altText: "Generated operator portrait for media e2e workflow",
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error || `Image generation failed (${response.status}).`);
    }

    const payload = await response.json() as {
      assetId: string;
      mimeType: string;
      uri: string;
    };

    const artifact: ArtifactEntry = {
      key: "generated-image",
      label: "Generated image",
      kind: "image",
      assetId: payload.assetId,
      uri: payload.uri,
      mimeType: payload.mimeType,
      note: "OpenAI image provider",
    };
    upsertArtifact("generated-image", artifact);
    return artifact;
  };

  const generateAudio = async (key: string, text: string, label: string) => {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error || `Audio generation failed (${response.status}).`);
    }

    const assetId = response.headers.get("X-User-File-Id");
    await response.arrayBuffer();

    if (!assetId) {
      throw new Error("Audio generation completed without an asset id.");
    }

    const artifact: ArtifactEntry = {
      key,
      label,
      kind: "audio",
      assetId,
      uri: `/api/user-files/${assetId}`,
      mimeType: "audio/mpeg",
      note: "OpenAI TTS",
    };
    upsertArtifact(key, artifact);
    return artifact;
  };

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) {
      return;
    }

    const uploaded = await uploadBlob(selected, selected.name);
    setUploadedImageName(selected.name);
    upsertArtifact("uploaded-image", {
      ...uploaded,
      key: "uploaded-image",
      label: "Uploaded image",
      kind: "image",
      note: selected.name,
    });
  };

  const handleVideoUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []).slice(0, 2);
    if (selectedFiles.length === 0) {
      return;
    }

    const uploadedEntries = await Promise.all(
      selectedFiles.map(async (selected, index) => {
        const uploaded = await uploadBlob(selected, selected.name);
        const key = `uploaded-video-${index + 1}`;
        upsertArtifact(key, {
          ...uploaded,
          key,
          label: `Uploaded video ${index + 1}`,
          kind: "video",
          note: selected.name,
        });

        return selected.name;
      }),
    );

    setUploadedVideoNames(uploadedEntries);
  };

  const captureSvgAsset = async (
    containerRef: React.RefObject<HTMLDivElement | null>,
    svgSelector: string,
    fileStem: string,
    key: string,
    label: string,
  ) => {
    const container = containerRef.current;
    const svg = container?.querySelector(svgSelector) ?? null;
    if (!(svg instanceof SVGSVGElement)) {
      throw new Error(`${label} SVG is not ready.`);
    }

    const blob = await rasterizeSvgToPngBlob(svg);
    const uploaded = await uploadBlob(blob, `${fileStem}.png`);
    const artifact: ArtifactEntry = {
      ...uploaded,
      key,
      label,
      kind: "image",
      note: "Rasterized from real renderer output",
    };
    upsertArtifact(key, artifact);
    return artifact;
  };

  const composeVideo = async (key: string, label: string, visualAssetId: string, audioAssetId: string) => {
    const plan: MediaCompositionPlan = {
      id: `${key}-${Date.now()}`,
      conversationId: key,
      visualClips: [{ assetId: visualAssetId, kind: "image", duration: 24 }],
      audioClips: [{ assetId: audioAssetId, kind: "audio" }],
      subtitlePolicy: "none",
      waveformPolicy: "none",
      outputFormat: "mp4",
      resolution: { width: 1280, height: 720 },
    };

    const result = await new FfmpegBrowserExecutor().execute(plan, {
      conversationId: null,
      userId: "browser",
    });

    if (result.status !== "succeeded" || !result.envelope) {
      throw new Error(result.failureCode || "Video composition failed.");
    }

    const artifact = result.envelope.artifacts?.[0];
    if (!artifact?.assetId || !artifact.uri) {
      throw new Error("Composed video returned no artifact.");
    }

    const entry: ArtifactEntry = {
      key,
      label,
      kind: "video",
      assetId: artifact.assetId,
      uri: artifact.uri,
      mimeType: artifact.mimeType,
      note: typeof result.envelope.replaySnapshot?.route === "string"
        ? result.envelope.replaySnapshot.route
        : undefined,
    };
    upsertArtifact(key, entry);
    return entry;
  };

  const concatVideos = async (key: string, label: string, videoAssetIds: string[]) => {
    const plan: MediaCompositionPlan = {
      id: `${key}-${Date.now()}`,
      conversationId: key,
      visualClips: videoAssetIds.map((assetId) => ({ assetId, kind: "video" })),
      audioClips: [],
      subtitlePolicy: "none",
      waveformPolicy: "none",
      outputFormat: "mp4",
    };

    const artifact = await composeRemotely(plan);

    const entry: ArtifactEntry = {
      key,
      label,
      kind: "video",
      assetId: artifact.assetId,
      uri: artifact.uri,
      mimeType: artifact.mimeType,
      note: artifact.note === "deferred_remote"
        ? "Concatenated media worker video"
        : artifact.note,
    };
    upsertArtifact(key, entry);
    return entry;
  };

  const runWorkflow = async (key: string, runner: () => Promise<void>) => {
    setWorkflowState(key, { status: "running" });
    try {
      await runner();
      setWorkflowState(key, { status: "succeeded" });
    } catch (error) {
      setWorkflowState(key, {
        status: "failed",
        error: error instanceof Error ? error.message : "Workflow failed.",
      });
      throw error;
    }
  };

  const workflow1 = () => runWorkflow("workflow1", async () => {
    const image = artifacts["generated-image"] ?? await generateImage();
    const audio = await generateAudio(
      "workflow1-audio",
      "This acceptance workflow pairs a generated editorial image with a narrated explanation to create a real video artifact for inspection.",
      "Workflow 1 audio",
    );
    await composeVideo("workflow1-video", "Workflow 1 video", image.assetId, audio.assetId);
  });

  const workflow2 = () => runWorkflow("workflow2", async () => {
    const uploaded = artifacts["uploaded-image"];
    if (!uploaded) {
      throw new Error("Upload an image through the file input before running workflow 2.");
    }

    const audio = await generateAudio(
      "workflow2-audio",
      "This acceptance workflow uses a user uploaded image and a generated audio narration to produce a composed video.",
      "Workflow 2 audio",
    );
    await composeVideo("workflow2-video", "Workflow 2 video", uploaded.assetId, audio.assetId);
  });

  const workflow3 = () => runWorkflow("workflow3", async () => {
    await sleep(200);
    const chartImage = await captureSvgAsset(
      chartContainerRef,
      '[data-testid="mermaid-viewport"] svg',
      "workflow3-chart",
      "workflow3-chart-image",
      "Workflow 3 chart image",
    );
    const audio = await generateAudio(
      "workflow3-audio",
      "This acceptance workflow uses a generated chart visualization and a generated audio narration to produce a video artifact.",
      "Workflow 3 audio",
    );
    await composeVideo("workflow3-video", "Workflow 3 video", chartImage.assetId, audio.assetId);
  });

  const workflow4 = () => runWorkflow("workflow4", async () => {
    await sleep(200);
    const graphImage = await captureSvgAsset(
      graphContainerRef,
      '[data-testid="graph-svg"]',
      "workflow4-graph",
      "workflow4-graph-image",
      "Workflow 4 graph image",
    );
    const audio = await generateAudio(
      "workflow4-audio",
      "This acceptance workflow uses a generated graph visualization and a generated audio narration to produce a real composed video.",
      "Workflow 4 audio",
    );
    await composeVideo("workflow4-video", "Workflow 4 video", graphImage.assetId, audio.assetId);
  });

  const workflow5 = () => runWorkflow("workflow5", async () => {
    const videoIds = [
      artifacts["workflow1-video"]?.assetId,
      artifacts["workflow2-video"]?.assetId,
      artifacts["workflow3-video"]?.assetId,
      artifacts["workflow4-video"]?.assetId,
    ].filter((value): value is string => typeof value === "string");

    if (videoIds.length !== 4) {
      throw new Error("Run workflows 1 through 4 successfully before combining them.");
    }

    await concatVideos("workflow5-video", "Workflow 5 combined video", videoIds);
  });

  const workflow6 = () => runWorkflow("workflow6", async () => {
    const uploadedVideos: UploadedVideoEntry[] = [
      artifacts["uploaded-video-1"],
      artifacts["uploaded-video-2"],
    ].filter((value): value is ArtifactEntry => Boolean(value && value.kind === "video"))
      .map((artifact) => ({ key: artifact.key, label: artifact.label, assetId: artifact.assetId }));

    if (uploadedVideos.length !== 2) {
      throw new Error("Upload two MP4 clips before running workflow 6.");
    }

    await concatVideos(
      "workflow6-video",
      "Workflow 6 uploaded clip concat",
      uploadedVideos.map((artifact) => artifact.assetId),
    );
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/55">Media E2E Harness</p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground">Live media workflow lab</h1>
        <p className="max-w-3xl text-sm text-foreground/70">
          This harness uses the real image provider, the real TTS route, the real upload store, the real browser FFmpeg worker,
          and the real server media worker for concat validation.
          The Playwright suite copies the finished MP4 files into test-results for inspection after the run.
        </p>
      </header>

      <section className="grid gap-4 rounded-3xl border border-foreground/10 bg-background/70 p-5 md:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="generated-image-prompt">Generated image prompt</label>
            <textarea
              id="generated-image-prompt"
              value={generatedImagePrompt}
              onChange={(event) => setGeneratedImagePrompt(event.target.value)}
              className="min-h-28 w-full rounded-2xl border border-foreground/12 bg-background px-4 py-3 text-sm text-foreground outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void workflow1()}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Run Workflow 1
            </button>
            <label className="inline-flex cursor-pointer items-center rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground">
              Upload workflow image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                aria-label="Upload workflow image"
                onChange={(event) => void handleUploadChange(event)}
              />
            </label>
            <label className="inline-flex cursor-pointer items-center rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground">
              Upload workflow videos
              <input
                type="file"
                accept="video/mp4"
                multiple
                className="hidden"
                aria-label="Upload workflow videos"
                onChange={(event) => void handleVideoUploadChange(event)}
              />
            </label>
            <button
              type="button"
              onClick={() => void workflow2()}
              className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground"
            >
              Run Workflow 2
            </button>
            <button
              type="button"
              onClick={() => void workflow3()}
              className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground"
            >
              Run Workflow 3
            </button>
            <button
              type="button"
              onClick={() => void workflow4()}
              className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground"
            >
              Run Workflow 4
            </button>
            <button
              type="button"
              onClick={() => void workflow5()}
              className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground"
            >
              Run Workflow 5
            </button>
            <button
              type="button"
              onClick={() => void workflow6()}
              className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground"
            >
              Run Workflow 6
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(workflows).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-foreground/10 bg-background/80 p-3" data-testid={`status-${key}`}>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">{key}</div>
                <div className="mt-2 text-sm text-foreground">{value.status}</div>
                {value.error ? <p className="mt-2 text-xs text-red-600">{value.error}</p> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-foreground/10 bg-background/85 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground/55">Artifact manifest</h2>
          <ul className="mt-4 space-y-3">
            {manifest.map((artifact) => (
              <li key={artifact.key} className="rounded-2xl border border-foreground/10 bg-background px-3 py-2 text-sm">
                <div className="font-medium text-foreground">{artifact.label}</div>
                <div className="text-xs text-foreground/60">{artifact.kind} · {artifact.assetId}</div>
                {artifact.note ? <div className="text-xs text-foreground/60">{artifact.note}</div> : null}
                <a
                  href={artifact.uri}
                  className="mt-1 inline-flex text-xs font-medium text-blue-700 underline underline-offset-4"
                  data-testid={`artifact-link-${artifact.key}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open asset
                </a>
              </li>
            ))}
          </ul>
          <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-3 text-xs text-slate-100" data-testid="manifest-json">
            {JSON.stringify(manifest, null, 2)}
          </pre>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div ref={chartContainerRef} data-testid="media-e2e-chart" className="rounded-3xl border border-foreground/10 bg-background/75 p-4">
          <MermaidRenderer
            code={chartCode}
            title="Workflow 3 chart"
            caption="Real Mermaid render used for screenshot upload"
            downloadFileName="workflow_3_chart"
          />
        </div>

        <div ref={graphContainerRef} data-testid="media-e2e-graph" className="rounded-3xl border border-foreground/10 bg-background/75 p-4">
          <GraphRenderer
            graph={graphPayload.graph}
            title={graphPayload.title}
            caption={graphPayload.caption}
            summary={graphPayload.summary}
            downloadFileName={graphPayload.downloadFileName}
            dataPreview={graphPayload.dataPreview}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-foreground/10 bg-background/75 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground/55">Generated image preview</h2>
          {artifacts["generated-image"] ? (
            <img
              src={artifacts["generated-image"].uri}
              alt="Generated workflow source"
              className="mt-4 w-full rounded-2xl border border-foreground/10 object-cover"
              data-testid="generated-image-preview"
            />
          ) : (
            <p className="mt-4 text-sm text-foreground/60">Run workflow 1 to generate the source image.</p>
          )}
        </div>

        <div className="rounded-3xl border border-foreground/10 bg-background/75 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground/55">Uploaded image preview</h2>
          {artifacts["uploaded-image"] ? (
            <>
              <img
                src={artifacts["uploaded-image"].uri}
                alt="Uploaded workflow source"
                className="mt-4 w-full rounded-2xl border border-foreground/10 object-cover"
                data-testid="uploaded-image-preview"
              />
              <p className="mt-2 text-xs text-foreground/60">{uploadedImageName}</p>
            </>
          ) : (
            <p className="mt-4 text-sm text-foreground/60">Use the upload control above before running workflow 2.</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-foreground/10 bg-background/75 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground/55">Video playback surface</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {manifest.filter((artifact) => artifact.kind === "video").map((artifact) => (
            <figure key={artifact.key} className="rounded-2xl border border-foreground/10 bg-background p-3">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                controls
                preload="metadata"
                src={artifact.uri}
                className="w-full rounded-xl border border-foreground/10 bg-black"
                data-testid={`artifact-video-${artifact.key}`}
              />
              <figcaption className="mt-2 text-xs text-foreground/65">
                <div className="font-medium text-foreground">{artifact.label}</div>
                {artifact.note ? <div>{artifact.note}</div> : null}
              </figcaption>
            </figure>
          ))}
        </div>
        {uploadedVideoNames.length > 0 ? (
          <p className="mt-4 text-xs text-foreground/60" data-testid="uploaded-video-names">
            Uploaded fixture clips: {uploadedVideoNames.join(", ")}
          </p>
        ) : null}
      </section>
    </main>
  );
}