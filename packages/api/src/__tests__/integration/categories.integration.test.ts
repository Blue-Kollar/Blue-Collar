/**
 * Integration tests for categories endpoints.
 * DB/Redis/external deps are mocked; full HTTP cycle via supertest.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeAuthToken } from "../test-harness.js";


// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../db.js", () => ({
  db: {
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    user: { findUnique: vi.fn() },
  },
  disconnectDb: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../config/redis.js", async () => (await import("../test-harness.js")).infraMocks.redis());
vi.mock("../../config/env.js", async () => (await import("../test-harness.js")).infraMocks.env());
vi.mock("../../openapi/docs.js", async () => (await import("../test-harness.js")).infraMocks.openapiDocs());
vi.mock("../../config/passport.js", async () => (await import("../test-harness.js")).infraMocks.passport());
vi.mock("../../middleware/requestLogger.js", async () => (await import("../test-harness.js")).infraMocks.requestLogger());
vi.mock("../../queue/index.js", async () => (await import("../test-harness.js")).infraMocks.queue());
vi.mock("../../events/index.js", async () => (await import("../test-harness.js")).infraMocks.events());
vi.mock("../../config/rateLimiter.js", async () => (await import("../test-harness.js")).infraMocks.rateLimiter());
vi.mock("../../middleware/versionRateLimit.js", async () => (await import("../test-harness.js")).infraMocks.versionRateLimit());
vi.mock("../../middleware/userRateLimit.js", async () => (await import("../test-harness.js")).infraMocks.userRateLimit());
vi.mock("../../mailer/transport.js", async () => (await import("../test-harness.js")).infraMocks.mailerTransport());

import app from "../../app.js";
import { db } from "../../db.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const cat1 = { id: "cat-1", name: "Plumbing", description: "Fix pipes", icon: null, createdAt: new Date(), updatedAt: new Date() };
const cat2 = { id: "cat-2", name: "Electrical", description: "Wiring", icon: null, createdAt: new Date(), updatedAt: new Date() };

// ─── GET /api/categories ──────────────────────────────────────────────────────

describe("GET /api/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.category.findMany).mockResolvedValue([cat1, cat2] as any);
  });

  it("returns 200 with list of categories (public endpoint)", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("is accessible without authentication", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
  });

  it("returns categories with id and name fields", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    const categories = res.body.data;
    if (categories.length > 0) {
      expect(categories[0]).toHaveProperty("id");
      expect(categories[0]).toHaveProperty("name");
    }
  });
});

// ─── GET /api/categories/:id ──────────────────────────────────────────────────

describe("GET /api/categories/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.category.findUnique).mockResolvedValue(cat1 as any);
  });

  it("returns 200 with category data for a valid id", async () => {
    const res = await request(app).get("/api/categories/cat-1");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
  });

  it("returns 404 when category does not exist", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue(null);
    const res = await request(app).get("/api/categories/nonexistent");
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/categories — admin-only RBAC ───────────────────────────────────

describe("POST /api/categories — RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1", email: "test@example.com", role: "user", verified: true,
    } as any);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .post("/api/categories")
      .send({ name: "Carpentry" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when a USER tries to create a category", async () => {
    const token = makeAuthToken("user");
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Carpentry" });
    expect(res.status).toBe(403);
  });

  it("returns 403 when a CURATOR tries to create a category", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1", email: "test@example.com", role: "curator", verified: true,
    } as any);
    const token = makeAuthToken("curator");
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Carpentry" });
    expect(res.status).toBe(403);
  });
});

// ─── PUT /api/categories/:id — admin-only RBAC ────────────────────────────────

describe("PUT /api/categories/:id — RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1", email: "test@example.com", role: "user", verified: true,
    } as any);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .put("/api/categories/cat-1")
      .send({ name: "Updated" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when USER tries to update a category", async () => {
    const token = makeAuthToken("user");
    const res = await request(app)
      .put("/api/categories/cat-1")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated" });
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/categories/:id — admin-only RBAC ─────────────────────────────

describe("DELETE /api/categories/:id — RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1", email: "test@example.com", role: "user", verified: true,
    } as any);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).delete("/api/categories/cat-1");
    expect(res.status).toBe(401);
  });

  it("returns 403 when USER tries to delete a category", async () => {
    const token = makeAuthToken("user");
    const res = await request(app)
      .delete("/api/categories/cat-1")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
