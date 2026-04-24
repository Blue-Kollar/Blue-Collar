import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction } from "express";
process.env.JWT_SECRET = "test-secret";
const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
}));

vi.mock("../utils/redis.js", () => ({
  default: redisMock,
}));
vi.mock("../utils/config/env.js", () => ({
  env: { JWT_SECRET: "test-secret" }
}))
import { rateLimiter } from "../middleware/rateLimiter.js";
import jwt from "jsonwebtoken";
function makeReq(overrides: Record<string, any> = {}): any {
  return {
    headers: {},
    ip: "127.0.0.1",
    ...overrides,
  };
}
function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}
function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}
function makeAuthHeader(role: string, id = "user-1") {
  const token = jwt.sign({ id, role }, "test-secret");
  return { authorization: `Bearer ${token}` };
}
function setupRedisDefault() {
  redisMock.get.mockResolvedValue(null),
    redisMock.incr.mockResolvedValue(1),
    redisMock.expire.mockResolvedValue(1),
    redisMock.ttl.mockResolvedValue(900),
    redisMock.set.mockResolvedValue("ok")
}
describe("admin bypass", () => {
  beforeEach(() => {
    vi.clearAllMocks(),
      setupRedisDefault()
  });
  it("calls next() immediately for admin users without touching redis", async () => {
    const req = makeReq({ headers: makeAuthHeader("admin") });
    const res = makeRes();
    const next = makeNext();
    await rateLimiter(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(redisMock.get).not.toHaveBeenCalled();
    expect(redisMock.incr).not.toHaveBeenCalled();
  })
})
describe("anonymous rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRedisDefault()
  })
  it("calls  next() for anonymous user within the limit", async () => {
    redisMock.incr.mockResolvedValue(10);
    const req = makeReq();
    const res = makeRes()
    const next = makeNext()
    await rateLimiter(req, res, next)
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  })
  it("returns 429 when anonymous user exceeds 30 request", async () => {
    redisMock.incr.mockResolvedValueOnce(31).mockResolvedValueOnce(1);
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();
    await rateLimiter(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "error", message: "Rate limit exceeded." }),)
    expect(next).not.toHaveBeenCalled()
  })
  it("sets X-rateLimit headers on every request", async () => {
    redisMock.incr.mockResolvedValue(5);
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();
    await rateLimiter(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 30)
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 25)
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Reset", expect.any(Number))
  })
})
describe("authenticated-rate-limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRedisDefault();
  })
  it("calls next() for authenticated user within the 100 request limit", async () => {
    redisMock.incr.mockResolvedValue(50)
    const req = makeReq({ headers: makeAuthHeader("user") })
    const res = makeRes()
    const next = makeNext()
    await rateLimiter(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  })
  it("returns 429 when authenticated user exceeds 100 requests", async () => {
    redisMock.incr.mockResolvedValueOnce(101).mockResolvedValueOnce(1);
    const req = makeReq({ headers: makeAuthHeader("user") })
    const res = makeRes();
    const next = makeNext();
    await rateLimiter(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429)
    expect(next).not.to.toHaveBeenCalledWith();
  })
  it("uses auth:<id> as the identifier, not the IP", async () => {
    redisMock.incr.mockResolvedValue(1);
    const req = makeReq({ headers: makeAuthHeader("user", "user-29") })
    const res = makeRes();
    const next = makeNext()
    await rateLimiter(req, res, next);
    expect(redisMock.incr).toHaveBeenCalledWith("ratelimit:auth:user-29");
  })
})
describe("blocked-user", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it("returns 429 with Retry-After header when user is blocked", async () => {
    const blockedUntil = Date.now() + 60_000;
    redisMock.get.mockResolvedValue(String(blockedUntil));
    const req = makeReq()
    const res = makeRes()
    const next = makeNext()
    await rateLimiter(req, res, next)
    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(Number))
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error" }),
    );
    expect(redisMock.incr).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  })
  it("calls next() if the block has already expired", async () => {
    const expiredBlock = Date.now() - 1000
    redisMock.get.mockResolvedValue(String(expiredBlock))
    redisMock.incr.mockResolvedValue(1)
    redisMock.ttl.mockResolvedValue(900)
    redisMock.expire.mockResolvedValue(1)
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();
    await rateLimiter(req, res, next)
    expect(next).toHaveBeenCalledOnce();
  })
})
describe("exponential backoff on violations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRedisDefault()
  });
  it("blocks for 2 minutes on the first violation", async () => {
    redisMock.incr
      .mockResolvedValueOnce(31)
      .mockResolvedValueOnce(1);
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();
    await rateLimiter(req, res, next);
    const body = res.json.mock.calls[0][0];
    expect(body.retryAfter).toBe(Math.pow(2, 1) * 60);
  })
  it("blocks for 4 minutes on the second violation", async () => {
    redisMock.incr
      .mockResolvedValueOnce(31)
      .mockResolvedValueOnce(2);
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();
    await rateLimiter(req, res, next);
    const body = res.json.mock.calls[0][0];
    expect(body.retryAfter).toBe(Math.pow(2, 2) * 60);
  })
})