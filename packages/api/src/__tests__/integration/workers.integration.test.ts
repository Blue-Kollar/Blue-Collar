/**
 * Integration tests for worker endpoints (happy paths + failure cases).
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
    worker: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    review: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
      findFirst: vi.fn(),
    },
    notification: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    location: { findMany: vi.fn() },
    workerAnalytics: { findUnique: vi.fn(), upsert: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
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

const fakeCategory = { id: "cat-1", name: "Plumbing", description: null, icon: null };
const fakeWorker = {
  id: "worker-1",
  name: "Jane Smith",
  bio: "Expert plumber",
  phone: "+2349000000000",
  email: "jane@example.com",
  walletAddress: null,
  isActive: true,
  isVerified: false,
  locationId: null,
  latitude: null,
  longitude: null,
  curatorId: "user-1",
  categoryId: "cat-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  category: fakeCategory,
  location: null,
  _count: { reviews: 0 },
  curator: { id: "user-1", firstName: "Jane", lastName: "Curator", avatar: null },
  portfolio: [],
};

function makeToken(role = "curator", id = "user-1") {
  return jwt.sign(
    { id, email: "curator@example.com", role },
    "test-integration-secret",
    { expiresIn: "1h" }
  );
}

// ─── GET /api/workers ─────────────────────────────────────────────────────────

describe("GET /api/workers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.worker.findMany).mockResolvedValue([fakeWorker] as any);
    vi.mocked(db.worker.count).mockResolvedValue(1);
    vi.mocked(db.review.groupBy).mockResolvedValue([] as any);
    vi.mocked(db.review.aggregate).mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } } as any);
    vi.mocked(db.$queryRaw).mockResolvedValue([]);
  });

  it("is a public endpoint returning 200", async () => {
    const res = await request(app).get("/api/workers");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
  });

  it("returns paginated metadata", async () => {
    const res = await request(app).get("/api/workers?page=1&limit=10");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("meta");
  });

  it("accepts a category filter without crashing", async () => {
    vi.mocked(db.worker.findMany).mockResolvedValue([] as any);
    vi.mocked(db.worker.count).mockResolvedValue(0);
    const res = await request(app).get("/api/workers?category=cat-1");
    expect(res.status).toBe(200);
  });

  it("accepts a search param without crashing", async () => {
    vi.mocked(db.worker.findMany).mockResolvedValue([] as any);
    vi.mocked(db.worker.count).mockResolvedValue(0);
    vi.mocked(db.$queryRaw).mockResolvedValue([]);
    const res = await request(app).get("/api/workers?search=plumber");
    expect(res.status).toBe(200);
  });
});

// ─── GET /api/workers/:id ─────────────────────────────────────────────────────

describe("GET /api/workers/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.worker.findUnique).mockResolvedValue(fakeWorker as any);
    vi.mocked(db.review.findMany).mockResolvedValue([] as any);
    vi.mocked(db.review.count).mockResolvedValue(0);
    vi.mocked(db.review.aggregate).mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } } as any);
    vi.mocked(db.workerAnalytics.findUnique).mockResolvedValue(null);
    vi.mocked(db.workerAnalytics.upsert).mockResolvedValue({} as any);
  });

  it("returns 200 with worker data for a valid id", async () => {
    const res = await request(app).get("/api/workers/worker-1");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
  });

  it("returns 404 when worker does not exist", async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue(null);
    const res = await request(app).get("/api/workers/nonexistent");
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/workers ────────────────────────────────────────────────────────

describe("POST /api/workers", () => {
  const validWorker = {
    name: "New Worker",
    categoryId: "cat-1",
    phone: "+2349000000001",
    bio: "Great worker",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1", email: "curator@example.com", role: "curator", verified: true,
    } as any);
    vi.mocked(db.worker.create).mockResolvedValue(fakeWorker as any);
    vi.mocked(db.category.findUnique).mockResolvedValue(fakeCategory as any);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).post("/api/workers").send(validWorker);
    expect(res.status).toBe(401);
  });

  it("returns 403 when USER (non-curator) tries to create a worker", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1", email: "user@example.com", role: "user", verified: true,
    } as any);
    const token = makeToken("user");
    const res = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send(validWorker);
    expect(res.status).toBe(403);
  });

  it("returns 400 with missing required fields", async () => {
    const token = makeToken("curator");
    const res = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({ bio: "missing name and category" });
    expect(res.status).toBe(400);
  });
});

// ─── PUT /api/workers/:id ─────────────────────────────────────────────────────

describe("PUT /api/workers/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1", email: "curator@example.com", role: "curator", verified: true,
    } as any);
    vi.mocked(db.worker.findUnique).mockResolvedValue({ ...fakeWorker, curatorId: "user-1" } as any);
    vi.mocked(db.worker.update).mockResolvedValue({ ...fakeWorker, name: "Updated Name" } as any);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .put("/api/workers/worker-1")
      .send({ name: "Updated" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when a USER (non-curator) tries to update", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1", email: "user@example.com", role: "user", verified: true,
    } as any);
    const token = makeToken("user", "user-1");
    const res = await request(app)
      .put("/api/workers/worker-1")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated" });
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/workers/:id ──────────────────────────────────────────────────

describe("DELETE /api/workers/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1", email: "curator@example.com", role: "curator", verified: true,
    } as any);
    vi.mocked(db.worker.findUnique).mockResolvedValue({ ...fakeWorker, curatorId: "user-1" } as any);
    vi.mocked(db.worker.delete).mockResolvedValue(fakeWorker as any);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).delete("/api/workers/worker-1");
    expect(res.status).toBe(401);
  });

  it("returns 403 when a USER (non-curator) tries to delete", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1", email: "user@example.com", role: "user", verified: true,
    } as any);
    const token = makeToken("user", "user-1");
    const res = await request(app)
      .delete("/api/workers/worker-1")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ─── POST /api/workers/:id/reviews ────────────────────────────────────────────

describe("POST /api/workers/:id/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.worker.findUnique).mockResolvedValue(fakeWorker as any);
    vi.mocked(db.review.findFirst).mockResolvedValue(null);
    vi.mocked(db.review.create).mockResolvedValue({
      id: "rev-1", rating: 4, comment: "Great!",
      workerId: "worker-1", authorId: "user-2",
      createdAt: new Date(),
      author: { id: "user-2", firstName: "Bob", lastName: "Doe", avatar: null },
    } as any);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-2", email: "user@example.com", role: "user", verified: true,
    } as any);
    vi.mocked(db.notification.create).mockResolvedValue({} as any);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .post("/api/workers/worker-1/reviews")
      .send({ rating: 4, comment: "Good" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when rating is out of range", async () => {
    const token = makeToken("user", "user-2");
    const res = await request(app)
      .post("/api/workers/worker-1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ rating: 10 });
    expect(res.status).toBe(400);
  });

  it("returns 400 when rating is missing", async () => {
    const token = makeToken("user", "user-2");
    const res = await request(app)
      .post("/api/workers/worker-1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ comment: "No rating provided" });
    expect(res.status).toBe(400);
  });
});
