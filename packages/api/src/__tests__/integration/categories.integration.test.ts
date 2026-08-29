/**
 * Integration tests for categories endpoints.
 * DB/Redis/external deps are mocked; full HTTP cycle via supertest.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

// ─── Env ─────────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-integration-secret";
process.env.DATABASE_URL = "postgresql://localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.APP_URL = "http://localhost:3000";

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
}));
vi.mock("../../config/redis.js", () => ({
  redis: { connect: vi.fn().mockResolvedValue(undefined), ping: vi.fn().mockResolvedValue("PONG") },
  cacheMetrics: { hits: 0, misses: 0 },
}));
vi.mock("../../config/env.js", () => ({
  env: {
    DATABASE_URL: "postgresql://localhost:5432/test",
    JWT_SECRET: "test-integration-secret",
    PORT: 3000,
    GOOGLE_CLIENT_ID: "test",
    GOOGLE_CLIENT_SECRET: "test",
    MAIL_HOST: "smtp.test.local",
    MAIL_PORT: 587,
    MAIL_USER: "test",
    MAIL_PASS: "test",
    APP_URL: "http://localhost:3000",
  },
}));
vi.mock("../../openapi/docs.js", () => { const fn = (_: any, __: any, next: any) => next(); fn.use = fn; fn.get = fn; fn.handle = fn; return { default: fn }; })
vi.mock("../../config/passport.js", () => ({
  default: {
    initialize: () => (_: any, __: any, next: any) => next(),
    authenticate: () => (_: any, __: any, next: any) => next(),
  },
}));
vi.mock("../../middleware/requestLogger.js", () => ({
  requestLogger: (_: any, __: any, next: any) => next(),
}));
vi.mock("../../events/index.js", () => ({ registerEventHandlers: vi.fn() }));
vi.mock("../../config/rateLimiter.js", () => ({
  moderateAuthRateLimiter: (_: any, __: any, next: any) => next(),
  strictAuthRateLimiter: (_: any, __: any, next: any) => next(),
}));
vi.mock("../../middleware/versionRateLimit.js", () => ({
  versionRateLimit: () => (_: any, __: any, next: any) => next(),
  getRateLimitStatus: (_: any, res: any) => res.json({ status: "ok" }),
}));
vi.mock("../../middleware/userRateLimit.js", () => ({
  contactRateLimit: (_: any, __: any, next: any) => next(),
  generalRateLimit: (_: any, __: any, next: any) => next(),
  userRateLimit: () => (_: any, __: any, next: any) => next(),
}));
vi.mock("../../mailer/transport.js", () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: "test-msg" }) },
}));

import app from "../../app.js";
import { db } from "../../db.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const cat1 = { id: "cat-1", name: "Plumbing", description: "Fix pipes", icon: null, createdAt: new Date(), updatedAt: new Date() };
const cat2 = { id: "cat-2", name: "Electrical", description: "Wiring", icon: null, createdAt: new Date(), updatedAt: new Date() };

function makeToken(role = "USER") {
  return jwt.sign(
    { id: "user-1", email: "test@example.com", role },
    "test-integration-secret",
    { expiresIn: "1h" }
  );
}

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
    const token = makeToken("user");
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
    const token = makeToken("curator");
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
    const token = makeToken("user");
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
    const token = makeToken("user");
    const res = await request(app)
      .delete("/api/categories/cat-1")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
