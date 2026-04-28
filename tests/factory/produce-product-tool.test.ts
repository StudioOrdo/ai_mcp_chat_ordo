import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { FactoryDataMapper } from "@/adapters/FactoryDataMapper";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import {
  createProduceProductTool,
  parseProduceProductInput,
} from "@/core/use-cases/tools/factory-production.tool";
import { ensureSchema } from "@/lib/db/schema";
import { DAGPlanner } from "@/lib/factory/dag-planner";
import { ProduceProductDeferredJobHandler } from "@/lib/factory/produce-product-deferred-job";
import { ProductionOrchestrator } from "@/lib/factory/production-orchestrator";
import { StageExecutorRegistry } from "@/lib/factory/stage-executor-registry";
import { AssetGenerationExecutor } from "@/lib/factory/stage-executors/asset-generation-executor";
import { CompositionExecutor } from "@/lib/factory/stage-executors/composition-executor";
import { DraftExecutor } from "@/lib/factory/stage-executors/draft-executor";
import { QAExecutor } from "@/lib/factory/stage-executors/qa-executor";
import { QAResolutionExecutor } from "@/lib/factory/stage-executors/qa-resolution-executor";
import { ReleaseExecutor } from "@/lib/factory/stage-executors/release-executor";
import { ResearchExecutor } from "@/lib/factory/stage-executors/research-executor";

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedUser(db: Database.Database, userId = "admin_user") {
  db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)`).run(
    userId,
    `${userId}@example.com`,
    "Admin User",
  );
  db.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'role_admin')`).run(userId);
}

function seedConversation(db: Database.Database, conversationId = "conv_tool_1", userId = "admin_user") {
  db.prepare(`INSERT OR IGNORE INTO conversations (id, user_id, title) VALUES (?, ?, 'Factory tool thread')`).run(
    conversationId,
    userId,
  );
}

function createHandler(db: Database.Database) {
  const repository = new FactoryDataMapper(db);
  const orchestrator = new ProductionOrchestrator({
    repository,
    executorRegistry: new StageExecutorRegistry([
      new ResearchExecutor({
        research: async () => ({
          summary: "Enough evidence was found.",
          confidenceScore: 0.9,
          sources: [
            {
              id: "src_1",
              title: "Benchmarks",
              url: "https://example.com",
              retrievedAt: "2026-04-27T12:00:00.000Z",
              relevanceScore: 0.8,
            },
          ],
          claims: [
            {
              id: "claim_1",
              text: "Email converts well.",
              supportingSourceIds: ["src_1"],
              confidence: 0.7,
            },
          ],
        }),
      }),
      new DraftExecutor({
        compose: async () => ({
          sections: [
            { id: "d1", kind: "heading", order: 0, text: "Launch", level: 1 },
            { id: "d2", kind: "paragraph", order: 1, text: "Build with owned channels." },
          ],
        }),
      }),
      new AssetGenerationExecutor({
        image: async () => ({
          uri: "/image.png",
          mimeType: "image/png",
          fileSizeBytes: 2048,
          qaStatus: "passed",
          qaFindings: [],
        }),
        chart: async () => ({
          uri: "/chart.png",
          mimeType: "image/png",
          fileSizeBytes: 2048,
          qaStatus: "passed",
          qaFindings: [],
        }),
      }),
      new CompositionExecutor({ compose: async () => ({ htmlContent: "<main>launch</main>" }) }),
      new QAExecutor(),
      new QAResolutionExecutor(),
      new ReleaseExecutor({
        publish: async ({ compositionId, targetChannels }) => ({
          publishedDestinations: targetChannels.map((channel) => ({
            channel,
            url: `https://example.com/${channel}/${compositionId}`,
          })),
        }),
      }),
    ]),
  });

  return createProduceProductTool(
    new ProduceProductDeferredJobHandler({
      planner: new DAGPlanner(),
      orchestrator,
      repository,
    }),
  );
}

function createBrief() {
  return {
    id: "brief_tool_1",
    schemaVersion: 1 as const,
    title: "Factory Tool Launch",
    topic: "phase 3 orchestration",
    description: "Catalog-bound factory production run",
    audience: "operators",
    tone: "precise",
    assetKinds: ["image", "chart"] as const,
    qaCriteria: ["accuracy", "completeness", "accessibility"] as const,
    targetChannels: ["web", "email"],
    executionPreferences: {
      autoRetryOnFailure: true,
      parallelizeAssets: false,
      maxAssetCount: 2,
    },
    createdAt: "2026-04-27T00:00:00.000Z",
    createdBy: "admin_user",
    sourceConversationId: "conv_tool_1",
  };
}

describe("produce_product catalog tool", () => {
  it("parses a validated ProductBrief payload", () => {
    const parsed = parseProduceProductInput({
      brief: createBrief(),
      previousWorkOrderIds: ["wo_0", "", 123, "wo_1"],
    });

    expect(parsed.previousWorkOrderIds).toEqual(["wo_0", "wo_1"]);
    expect(parsed.brief.title).toBe("Factory Tool Launch");
  });

  it("executes through the shared deferred handler path", async () => {
    const db = createDb();
    seedUser(db);
    seedConversation(db);

    const progress: Array<Record<string, unknown>> = [];
    const tool = createHandler(db);
    const context: ToolExecutionContext = {
      userId: "admin_user",
      role: "ADMIN",
      executionPrincipal: "system_worker",
      executionAllowedRoles: ["ADMIN"],
      conversationId: "conv_tool_1",
      toolInvocationId: "job_tool_1",
      reportProgress: async (update) => {
        progress.push(update as unknown as Record<string, unknown>);
      },
    };

    const result = await tool.command.execute(
      {
        brief: createBrief(),
        previousWorkOrderIds: [],
      },
      context,
    );

    expect(result.workOrderId).toMatch(/^wo_/);
    expect(result.releaseId).toMatch(/^release_/);
    expect(result.compositionId).toMatch(/^composition_/);
    expect(result.outputIds.length).toBeGreaterThanOrEqual(6);
    expect(progress.at(-1)?.progressPercent).toBe(100);
  });
});