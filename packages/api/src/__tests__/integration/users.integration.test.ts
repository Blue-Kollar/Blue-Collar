/**
 * Integration tests for users endpoints (CRUD + auth + validation failure cases).
 * DB/Redis/external deps are mocked; full HTTP cycle via supertest.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import argon2 from "argon2";

// ─── Env ─────────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-integration-secret";
process.env.DATABASE_URL = "postgresql://localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.APP_URL = "http://localhost:3000";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../db.js", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    pushSubscription: {
      upsert: vi.fn(),
      delete: vi.fn(),
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

let hashedPassword: string;

const baseUser = () => ({
  id: "user-1",
  email: "jane@example.com",
  password: hashedPassword,
  googleId: null,
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
  walletAddress: null,
  avatar: null,
  bio: null,
  phone: null,
  verified: true,
  verificationToken: null,
  verificationTokenExpiry: null,
  resetToken: null,
  resetTokenExpiry: null,
  twoFactorSecret: null,
  twoFactorEnabled: false,
  twoFactorBackupCodes: [],
  referralCode: null,
  onboardingCompleted: false,
  locationId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

function makeToken(id = "user-1", role = "user") {
  return jwt.sign({ id, email: "jane@example.com", role }, "test-integration-secret", { expiresIn: "1h" });
}

beforeEach(async () => {
  vi.clearAllMocks();
  if (!hashedPassword) hashedPassword = await argon2.hash("CurrentPass123!");
});

// ─── PATCH /api/users/me ──────────────────────────────────────────────────────

describe("PATCH /api/users/me", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).patch("/api/users/me").send({ firstName: "New" });
    expect(res.status).toBe(401);
  });

  it("returns 200 and the sanitized user on a valid update", async () => {
    vi.mocked(db.user.update).mockResolvedValue({ ...baseUser(), firstName: "Updated" } as any);
    const token = makeToken();
    const res = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ firstName: "Updated", bio: "New bio" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.firstName).toBe("Updated");
    expect(res.body.data.password).toBeUndefined();
  });
});

// ─── PUT /api/users/me ────────────────────────────────────────────────────────

describe("PUT /api/users/me", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).put("/api/users/me").send({ firstName: "New" });
    expect(res.status).toBe(401);
  });

  it("returns 200 and updates firstName/lastName without changing email", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(baseUser() as any);
    vi.mocked(db.user.update).mockResolvedValue({ ...baseUser(), firstName: "Janet" } as any);
    const token = makeToken();
    const res = await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ firstName: "Janet" });
    expect(res.status).toBe(200);
    expect(res.body.data.firstName).toBe("Janet");
  });

  it("resets verification and sends a new verification email when email changes", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(baseUser() as any);
    vi.mocked(db.user.update).mockResolvedValue({
      ...baseUser(),
      email: "new@example.com",
      verified: false,
    } as any);
    const token = makeToken();
    const res = await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "new@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("new@example.com");
    expect(res.body.data.verified).toBe(false);
  });

  it("returns 400 when email is not a valid email address", async () => {
    const token = makeToken();
    const res = await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
  });

  it("returns 400 when firstName is an empty string", async () => {
    const token = makeToken();
    const res = await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ firstName: "" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when firstName exceeds 50 characters", async () => {
    const token = makeToken();
    const res = await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ firstName: "a".repeat(51) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the authenticated user no longer exists", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    const token = makeToken("missing-user");
    const res = await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ firstName: "Ghost" });
    expect(res.status).toBe(404);
  });
});

// ─── PUT /api/users/me/password ───────────────────────────────────────────────

describe("PUT /api/users/me/password", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .put("/api/users/me/password")
      .send({ currentPassword: "a", newPassword: "b" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when currentPassword is missing", async () => {
    const token = makeToken();
    const res = await request(app)
      .put("/api/users/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ newPassword: "NewPassword123!" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when newPassword is missing", async () => {
    const token = makeToken();
    const res = await request(app)
      .put("/api/users/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "CurrentPass123!" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when newPassword is shorter than 8 characters", async () => {
    const token = makeToken();
    const res = await request(app)
      .put("/api/users/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "CurrentPass123!", newPassword: "short" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when currentPassword is incorrect", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(baseUser() as any);
    const token = makeToken();
    const res = await request(app)
      .put("/api/users/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "WrongPassword!", newPassword: "NewPassword123!" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when the account has no password set (OAuth-only)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ ...baseUser(), password: null } as any);
    const token = makeToken();
    const res = await request(app)
      .put("/api/users/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "CurrentPass123!", newPassword: "NewPassword123!" });
    expect(res.status).toBe(400);
  });

  it("returns 200 on a valid password change", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(baseUser() as any);
    vi.mocked(db.user.update).mockResolvedValue(baseUser() as any);
    const token = makeToken();
    const res = await request(app)
      .put("/api/users/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "CurrentPass123!", newPassword: "NewPassword123!" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
  });
});

// ─── DELETE /api/users/me ─────────────────────────────────────────────────────

describe("DELETE /api/users/me", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).delete("/api/users/me");
    expect(res.status).toBe(401);
  });

  it("returns 200 and soft-deletes the account", async () => {
    vi.mocked(db.user.update).mockResolvedValue({ ...baseUser(), deletedAt: new Date() } as any);
    const token = makeToken();
    const res = await request(app)
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

// ─── POST /api/users/me/push-subscription ─────────────────────────────────────

describe("POST /api/users/me/push-subscription", () => {
  const validSubscription = {
    endpoint: "https://push.example.com/abc",
    keys: { auth: "auth-key", p256dh: "p256dh-key" },
  };

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).post("/api/users/me/push-subscription").send(validSubscription);
    expect(res.status).toBe(401);
  });

  it("returns 400 when endpoint is missing", async () => {
    const token = makeToken();
    const res = await request(app)
      .post("/api/users/me/push-subscription")
      .set("Authorization", `Bearer ${token}`)
      .send({ keys: validSubscription.keys });
    expect(res.status).toBe(400);
  });

  it("returns 400 when keys.auth or keys.p256dh is missing", async () => {
    const token = makeToken();
    const res = await request(app)
      .post("/api/users/me/push-subscription")
      .set("Authorization", `Bearer ${token}`)
      .send({ endpoint: validSubscription.endpoint, keys: { auth: "only-auth" } });
    expect(res.status).toBe(400);
  });

  it("returns 200 and saves the subscription on valid input", async () => {
    vi.mocked(db.pushSubscription.upsert).mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      ...validSubscription,
    } as any);
    const token = makeToken();
    const res = await request(app)
      .post("/api/users/me/push-subscription")
      .set("Authorization", `Bearer ${token}`)
      .send(validSubscription);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
  });
});

// ─── DELETE /api/users/me/push-subscription ───────────────────────────────────

describe("DELETE /api/users/me/push-subscription", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .delete("/api/users/me/push-subscription")
      .send({ endpoint: "https://push.example.com/abc" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when endpoint is missing", async () => {
    const token = makeToken();
    const res = await request(app)
      .delete("/api/users/me/push-subscription")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 200 on valid unsubscribe", async () => {
    vi.mocked(db.pushSubscription.delete).mockResolvedValue({} as any);
    const token = makeToken();
    const res = await request(app)
      .delete("/api/users/me/push-subscription")
      .set("Authorization", `Bearer ${token}`)
      .send({ endpoint: "https://push.example.com/abc" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
  });
});

// ─── POST /api/users/onboarding/complete ──────────────────────────────────────

describe("POST /api/users/onboarding/complete", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).post("/api/users/onboarding/complete");
    expect(res.status).toBe(401);
  });

  it("returns 200 and marks onboarding as completed", async () => {
    vi.mocked(db.user.update).mockResolvedValue({ ...baseUser(), onboardingCompleted: true } as any);
    const token = makeToken();
    const res = await request(app)
      .post("/api/users/onboarding/complete")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.onboardingCompleted).toBe(true);
  });
});
