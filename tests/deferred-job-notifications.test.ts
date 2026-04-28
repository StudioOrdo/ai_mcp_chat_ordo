import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobRequest } from "@/core/entities/job";

const {
  listByUserMock,
  markNotifiedMock,
  deleteByEndpointMock,
  preferenceGetMock,
  getDescriptorMock,
  setVapidDetailsMock,
  sendNotificationMock,
} = vi.hoisted(() => ({
  listByUserMock: vi.fn(),
  markNotifiedMock: vi.fn(),
  deleteByEndpointMock: vi.fn(),
  preferenceGetMock: vi.fn(),
  getDescriptorMock: vi.fn(),
  setVapidDetailsMock: vi.fn(),
  sendNotificationMock: vi.fn(),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: setVapidDetailsMock,
    sendNotification: sendNotificationMock,
  },
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getPushSubscriptionRepository: () => ({
    listByUser: listByUserMock,
    markNotified: markNotifiedMock,
    deleteByEndpoint: deleteByEndpointMock,
  }),
  getUserPreferencesDataMapper: () => ({
    get: preferenceGetMock,
  }),
}));

vi.mock("@/lib/chat/tool-composition-root", () => ({
  getToolComposition: () => ({
    registry: { getDescriptor: getDescriptorMock },
    executor: vi.fn(),
  }),
}));

vi.mock("@/lib/config/env", () => ({
  getWebPushPublicKey: () => "public-key",
  getWebPushPrivateKey: () => "private-key",
  getWebPushSubject: () => "mailto:ops@example.com",
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({}),
}));

function buildJob(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "job_1",
    conversationId: "conv_1",
    userId: "usr_1",
    toolName: "draft_content",
    status: "succeeded",
    priority: 100,
    dedupeKey: null,
    initiatorType: "user",
    requestPayload: {},
    resultPayload: null,
    errorMessage: null,
    progressPercent: null,
    progressLabel: null,
    attemptCount: 1,
    leaseExpiresAt: null,
    claimedBy: null,
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: null,
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: "2026-03-25T03:00:00.000Z",
    startedAt: "2026-03-25T03:00:01.000Z",
    completedAt: "2026-03-25T03:00:02.000Z",
    updatedAt: "2026-03-25T03:00:02.000Z",
    ...overrides,
  };
}

async function loadDispatcher() {
  const notificationsModule = await import("@/lib/jobs/deferred-job-notifications");
  return notificationsModule.createDeferredJobNotificationDispatcher();
}

describe("createDeferredJobNotificationDispatcher", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getDescriptorMock.mockReturnValue({
      name: "draft_content",
      deferred: { notificationPolicy: "completion-and-failure" },
    });
    preferenceGetMock.mockResolvedValue({
      key: "push_notifications",
      value: "enabled",
      updatedAt: "2026-03-25T03:00:00.000Z",
    });
    listByUserMock.mockResolvedValue([
      {
        endpoint: "https://push.example/sub_1",
        userId: "usr_1",
        expirationTime: null,
        p256dhKey: "p256dh-key",
        authKey: "auth-key",
        userAgent: "Safari",
        createdAt: "2026-03-25T03:00:00.000Z",
        updatedAt: "2026-03-25T03:00:00.000Z",
        lastNotifiedAt: null,
      },
    ]);
    sendNotificationMock.mockResolvedValue(undefined);
    markNotifiedMock.mockResolvedValue(undefined);
    deleteByEndpointMock.mockResolvedValue(undefined);
  });

  it("delivers completion notifications and marks the endpoint notified", async () => {
    const dispatcher = await loadDispatcher();

    const delivered = await dispatcher.notify(buildJob(), "result");

    expect(delivered).toEqual({
      status: "sent",
      attemptedCount: 1,
      deliveredCount: 1,
      failedCount: 0,
    });
    expect(setVapidDetailsMock).toHaveBeenCalledWith(
      "mailto:ops@example.com",
      "public-key",
      "private-key",
    );
    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://push.example/sub_1" }),
      expect.stringContaining('"jobId":"job_1"'),
    );
    expect(markNotifiedMock).toHaveBeenCalledWith(
      "https://push.example/sub_1",
      expect.any(String),
    );
  });

  it("suppresses canceled notifications for completion-and-failure policy", async () => {
    const dispatcher = await loadDispatcher();

    const delivered = await dispatcher.notify(buildJob({ status: "canceled" }), "canceled");

    expect(delivered).toEqual({
      status: "suppressed",
      reason: "policy_disabled",
    });
    expect(listByUserMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("honors disabled push preferences before looking up subscriptions", async () => {
    preferenceGetMock.mockResolvedValue({
      key: "push_notifications",
      value: "disabled",
      updatedAt: "2026-03-25T03:00:00.000Z",
    });
    const dispatcher = await loadDispatcher();

    const delivered = await dispatcher.notify(buildJob(), "result");

    expect(delivered).toEqual({
      status: "suppressed",
      reason: "preference_disabled",
    });
    expect(listByUserMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("deletes expired endpoints when web push returns 410", async () => {
    sendNotificationMock.mockRejectedValue({ statusCode: 410 });
    const dispatcher = await loadDispatcher();

    const delivered = await dispatcher.notify(buildJob(), "failed");

    expect(delivered).toEqual({
      status: "failed",
      reason: "delivery_error",
      attemptedCount: 1,
      failedCount: 1,
      lastErrorMessage: "[object Object]",
      lastErrorStatusCode: 410,
    });
    expect(deleteByEndpointMock).toHaveBeenCalledWith("https://push.example/sub_1");
  });

  it("delivers canceled notifications when the tool policy is all-terminal", async () => {
    getDescriptorMock.mockReturnValue({
      name: "publish_content",
      deferred: { notificationPolicy: "all-terminal" },
    });
    const dispatcher = await loadDispatcher();

    const delivered = await dispatcher.notify(
      buildJob({ toolName: "publish_content", status: "canceled" }),
      "canceled",
    );

    expect(delivered).toEqual({
      status: "sent",
      attemptedCount: 1,
      deliveredCount: 1,
      failedCount: 0,
    });
    expect(sendNotificationMock).toHaveBeenCalledOnce();
  });
});