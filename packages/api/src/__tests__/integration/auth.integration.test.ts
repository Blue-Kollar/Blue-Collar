/**
 * Integration tests for auth endpoints.
 * All DB/Redis/external deps are mocked; full HTTP cycle is exercised via supertest.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

// ─── Env ─────────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-integration-secret";
process.env.DATABASE_URL = "postgresql://localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.APP_URL = "http://localhost:3000";

// ─── Mocks (factories must not reference out-of-scope variables) ──────────────

vi.mock("../../db.js", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
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

const baseUser = {
  id: "user-1",
  email: "alice@example.com",
  firstName: "Alice",
  lastName: "Smith",
  role: "USER",
  verified: true,
  password: "placeholder",
  googleId: null,
  walletAddress: null,
  avatar: null,
  bio: null,
  phone: null,
  locationId: null,
  resetToken: null,
  resetTokenExpiry: null,
  verificationToken: null,
  verificationTokenExpiry: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken(payload: Record<string, unknown> = {}) {
  return jwt.sign(
    { id: "user-1", email: "alice@example.com", role: "USER", ...payload },
    "test-integration-secret",
    { expiresIn: "1h" }
  );
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue(baseUser as any);
  });

  it("returns 201 with valid registration data", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "newuser@example.com",
      password: "Password123!",
      firstName: "New",
      lastName: "User",
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
  });

  it("returns 400 when email is missing", async () => {
    const res = await request(app).post("/api/auth/register").send({
      password: "Password123!",
      firstName: "New",
      lastName: "User",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is too short", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "new@example.com",
      password: "short",
      firstName: "New",
      lastName: "User",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is malformed", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "not-an-email",
      password: "Password123!",
      firstName: "New",
      lastName: "User",
    });
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const hashed = await argon2.hash("Password123!");
    vi.mocked(db.user.findUnique).mockResolvedValue({ ...baseUser, password: hashed } as any);
    vi.mocked(db.refreshToken.create).mockResolvedValue({} as any);
  });

  it("returns 202 and a JWT token with valid credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "alice@example.com",
      password: "Password123!",
    });
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("success");
    expect(res.body.token).toBeDefined();
  });

  it("returns 400 when email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "Password123!" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com" });
    expect(res.status).toBe(400);
  });

  it("returns 401 when password is incorrect", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "alice@example.com",
      password: "WrongPassword!",
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when user does not exist", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    const res = await request(app).post("/api/auth/login").send({
      email: "ghost@example.com",
      password: "Password123!",
    });
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue(baseUser as any);
  });

  it("returns 200 with authenticated user data", async () => {
    const token = makeToken();
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with an invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer totally.invalid.token");
    expect(res.status).toBe(401);
  });

  it("returns 401 with an expired token", async () => {
    const expired = jwt.sign(
      { id: "user-1", email: "alice@example.com", role: "USER" },
      "test-integration-secret",
      { expiresIn: "-1s" }
    );
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/auth/logout ──────────────────────────────────────────────────

describe("DELETE /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue(baseUser as any);
    vi.mocked(db.refreshToken.updateMany).mockResolvedValue({ count: 0 } as any);
  });

  it("returns 200 when authenticated", async () => {
    const token = makeToken();
    const res = await request(app)
      .delete("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).delete("/api/auth/logout");
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue(baseUser as any);
    vi.mocked(db.user.update).mockResolvedValue(baseUser as any);
  });

  it("returns 200 even when user does not exist (prevents enumeration)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "ghost@example.com" });
    expect(res.status).toBe(200);
  });

  it("returns 400 when email is missing", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({});
    expect(res.status).toBe(400);
  });
});

// ─── RBAC: role enforcement ───────────────────────────────────────────────────

describe("RBAC — admin-only endpoints reject non-admin roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue(baseUser as any);
  });

  it("returns 403 when a USER tries to access /api/admin/users", async () => {
    const userToken = makeToken({ role: "user" });
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 403 when a CURATOR tries to access /api/admin/users", async () => {
    const curatorToken = makeToken({ role: "curator" });
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${curatorToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 401 for unauthenticated requests to /api/admin/users", async () => {
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
  });
});
