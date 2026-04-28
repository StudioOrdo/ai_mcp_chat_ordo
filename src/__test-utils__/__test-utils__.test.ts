/**
 * Self-tests for shared test utilities.
 *
 * This file proves the helpers work correctly before any migration begins.
 * Every helper function gets at least one deterministic assertion.
 */
import { describe, it, expect, vi } from "vitest";
import {
  createMockUser,
  createAdminUser,
  createAuthenticatedUser,
  createAnonymousUser,
  createStaffUser,
  createApprenticeUser,
  createGetSessionUserMock,
  createRouteRequest,
  createRouteParams,
  createJsonRequest,
  createConversationInteractorMock,
  createConversationRuntimeServicesMock,
  createMockRepositoryFactory,
} from "./index";

// ---------------------------------------------------------------------------
// fixtures.ts
// ---------------------------------------------------------------------------

describe("fixtures", () => {
  describe("createMockUser", () => {
    it("defaults to AUTHENTICATED with all required fields", () => {
      const user = createMockUser();
      expect(user.id).toBe("usr_1");
      expect(user.email).toBe("user@example.com");
      expect(user.name).toBe("User");
      expect(user.roles).toEqual(["AUTHENTICATED"]);
    });

    it("accepts a role parameter", () => {
      const user = createMockUser("ADMIN");
      expect(user.roles).toEqual(["ADMIN"]);
      expect(user.id).toBe("admin_1");
    });

    it("merges overrides without clobbering other defaults", () => {
      const user = createMockUser("STAFF", { id: "custom_id" });
      expect(user.id).toBe("custom_id");
      expect(user.roles).toEqual(["STAFF"]);
      expect(user.email).toBe("staff@example.com"); // default preserved
    });

    it("allows overriding roles array", () => {
      const user = createMockUser("ADMIN", { roles: ["ADMIN", "STAFF"] });
      expect(user.roles).toEqual(["ADMIN", "STAFF"]);
    });
  });

  describe("role-specific factories", () => {
    it("createAdminUser returns ADMIN role", () => {
      const user = createAdminUser();
      expect(user.roles).toEqual(["ADMIN"]);
      expect(user.id).toBe("admin_1");
    });

    it("createAuthenticatedUser returns AUTHENTICATED role", () => {
      const user = createAuthenticatedUser();
      expect(user.roles).toEqual(["AUTHENTICATED"]);
    });

    it("createAnonymousUser returns ANONYMOUS role", () => {
      const user = createAnonymousUser();
      expect(user.roles).toEqual(["ANONYMOUS"]);
      expect(user.id).toBe("anon_1");
    });

    it("createStaffUser returns STAFF role", () => {
      const user = createStaffUser();
      expect(user.roles).toEqual(["STAFF"]);
    });

    it("createApprenticeUser returns APPRENTICE role", () => {
      const user = createApprenticeUser();
      expect(user.roles).toEqual(["APPRENTICE"]);
    });

    it("all role factories accept overrides", () => {
      const user = createAdminUser({ id: "my_admin" });
      expect(user.id).toBe("my_admin");
      expect(user.roles).toEqual(["ADMIN"]);
    });
  });
});

// ---------------------------------------------------------------------------
// mock-auth.ts
// ---------------------------------------------------------------------------

describe("mock-auth", () => {
  it("createGetSessionUserMock returns a vi.fn resolved with the correct role", async () => {
    const mock = createGetSessionUserMock("STAFF");
    const user = await mock();
    expect(user.roles).toEqual(["STAFF"]);
    expect(user.id).toBe("staff_1");
  });

  it("defaults to ADMIN when no role is specified", async () => {
    const mock = createGetSessionUserMock();
    const user = await mock();
    expect(user.roles).toEqual(["ADMIN"]);
  });

  it("returned mock can be overridden per-case with mockResolvedValue", async () => {
    const mock = createGetSessionUserMock("ADMIN");
    mock.mockResolvedValueOnce(createMockUser("ANONYMOUS"));
    const user = await mock();
    expect(user.roles).toEqual(["ANONYMOUS"]);
    // subsequent call returns original default
    const user2 = await mock();
    expect(user2.roles).toEqual(["ADMIN"]);
  });
});

// ---------------------------------------------------------------------------
// request-helpers.ts
// ---------------------------------------------------------------------------

describe("request-helpers", () => {
  describe("createRouteRequest", () => {
    it("defaults to GET", () => {
      const req = createRouteRequest("/api/test");
      expect(req.method).toBe("GET");
    });

    it("accepts an absolute URL", () => {
      const req = createRouteRequest("http://example.com/api/test");
      expect(req.url).toBe("http://example.com/api/test");
    });

    it("prepends localhost for relative URLs", () => {
      const req = createRouteRequest("/api/test");
      expect(req.url).toBe("http://localhost:3000/api/test");
    });

    it("serializes JSON body for POST", async () => {
      const req = createRouteRequest("/api/test", "POST", { name: "test" });
      const body = await req.json();
      expect(body).toEqual({ name: "test" });
    });

    it("supports PATCH and DELETE", () => {
      expect(createRouteRequest("/api/test", "PATCH").method).toBe("PATCH");
      expect(createRouteRequest("/api/test", "DELETE").method).toBe("DELETE");
    });
  });

  describe("createRouteParams", () => {
    it("wraps id in a Promise", async () => {
      const params = createRouteParams("abc_123");
      const resolved = await params.params;
      expect(resolved.id).toBe("abc_123");
    });
  });

  describe("createJsonRequest", () => {
    it("creates a POST Request with JSON content type", async () => {
      const req = createJsonRequest("http://localhost/api", { key: "value" });
      expect(req.method).toBe("POST");
      expect(req.headers.get("Content-Type")).toBe("application/json");
      const body = await req.json();
      expect(body).toEqual({ key: "value" });
    });
  });
});

// ---------------------------------------------------------------------------
// conversation-helpers.ts
// ---------------------------------------------------------------------------

describe("conversation-helpers", () => {
  it("createConversationInteractorMock provides safe defaults", async () => {
    const interactor = createConversationInteractorMock();
    expect(await interactor.getActiveForUser()).toBeNull();
    expect(await interactor.list()).toEqual([]);
    expect(await interactor.get()).toBeNull();
  });

  it("createConversationInteractorMock accepts overrides", () => {
    const customGet = vi.fn().mockResolvedValue({ id: "conv_1" });
    const interactor = createConversationInteractorMock({ get: customGet });
    expect(interactor.get).toBe(customGet);
  });

  it("createConversationRuntimeServicesMock returns a vi.fn factory", () => {
    const mock = createConversationRuntimeServicesMock();
    expect(typeof mock).toBe("function");
    const services = mock();
    expect(services.getConversationInteractor).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// mock-repositories.ts
// ---------------------------------------------------------------------------

describe("mock-repositories", () => {
  it("createMockRepositoryFactory provides all common repo getters", () => {
    const factory = createMockRepositoryFactory();
    expect(factory.getBlogPostRepository).toBeDefined();
    expect(factory.getJobQueueRepository).toBeDefined();
    expect(factory.getUserDataMapper).toBeDefined();
    expect(factory.getConversationDataMapper).toBeDefined();
    expect(factory.getLeadRecordDataMapper).toBeDefined();
    expect(factory.getUserFileDataMapper).toBeDefined();
    expect(factory.getSystemSettingsDataMapper).toBeDefined();
  });

  it("default repo getters return objects with vi.fn() methods", () => {
    const factory = createMockRepositoryFactory();
    const blogRepo = factory.getBlogPostRepository();
    expect(blogRepo.findById).toBeDefined();
    expect(blogRepo.listPublished).toBeDefined();
    expect(typeof blogRepo.findById).toBe("function");
  });

  it("overrides replace the entire getter function", () => {
    const customFindById = vi.fn().mockResolvedValue({ id: "post_1" });
    const factory = createMockRepositoryFactory({
      getBlogPostRepository: () => ({ findById: customFindById }),
    });
    const blogRepo = factory.getBlogPostRepository();
    expect(blogRepo.findById).toBe(customFindById);
  });

  it("non-overridden repos keep their defaults when one repo is overridden", () => {
    const factory = createMockRepositoryFactory({
      getBlogPostRepository: () => ({ findById: vi.fn() }),
    });
    // Job queue should still have its defaults
    const jobRepo = factory.getJobQueueRepository();
    expect(jobRepo.createJob).toBeDefined();
    expect(jobRepo.appendEvent).toBeDefined();
  });

  it("default list methods resolve to empty arrays", async () => {
    const factory = createMockRepositoryFactory();
    const blogRepo = factory.getBlogPostRepository();
    expect(await blogRepo.listPublished()).toEqual([]);
    expect(await blogRepo.listForAdmin()).toEqual([]);
  });
});
