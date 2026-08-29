/**
 * Auth middleware tests (authenticate/authorize — see middleware/auth.ts),
 * plus request→service wiring tests for the workers controller
 * (src/controllers/workers.ts; deeper controller coverage lives in
 * controllers/workers.test.ts, and service-level behavior in
 * services/worker.service.test.ts).
 *
 * The worker.service.ts layer does not currently enforce per-worker
 * ownership (any curator can update/delete/toggle any worker's listing) —
 * the 403 propagation tests below only verify that *if* the service ever
 * throws an AppError, the controller translates it via handleError; they
 * are not asserting that ownership is checked today.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction } from "express";
import { AppError } from "../services/AppError.js";

// ─── Env setup ────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-secret";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../services/worker.service.js", () => ({
  listWorkersCursor: vi.fn(),
  listWorkersGeo: vi.fn(),
  listWorkers: vi.fn(),
  getWorkerWithPortfolio: vi.fn(),
  createWorkerWithMedia: vi.fn(),
  updateWorkerWithMedia: vi.fn(),
  deleteWorkerWithMedia: vi.fn(),
  toggleWorker: vi.fn(),
  listMyWorkers: vi.fn(),
}));

// search.service/stellar.service (imported by the controller) transitively
// import the real db.ts; stub it so nothing in this file touches Prisma.
vi.mock("../db.js", () => ({ db: {} }));

vi.mock("../middleware/cache.js", () => ({
  invalidateCachePattern: vi.fn().mockResolvedValue(undefined),
}));

// Pass workers through unchanged so tests assert on the raw mock data
vi.mock("../resources/index.js", () => ({
  WorkerResource: vi.fn((w: unknown) => w),
  WorkerCollection: vi.fn((ws: unknown[]) => ws),
}));

vi.mock("../config/env.js", () => ({
  env: { JWT_SECRET: "test-secret", APP_URL: "http://localhost:3000" },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import * as workerService from "../services/worker.service.js";
import {
  listWorkers,
  showWorker,
  createWorker,
  updateWorker,
  deleteWorker,
  toggleActivation,
} from "../controllers/workers.js";
import { authenticate, authorize } from "../middleware/auth.js";
import jwt from "jsonwebtoken";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

function makeReq(overrides: Record<string, any> = {}): any {
  return { body: {}, params: {}, query: {}, headers: {}, ...overrides };
}

const mockWorker = {
  id: "worker-1",
  name: "John Smith",
  bio: null,
  avatar: null,
  phone: "555-0100",
  email: null,
  walletAddress: null,
  isActive: true,
  isVerified: false,
  categoryId: "cat-1",
  curatorId: "curator-1",
  locationId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── authenticate middleware ──────────────────────────────────────────────────

describe("authenticate middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no Authorization header is provided", () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    const next = makeNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 401 }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for an invalid or tampered token", () => {
    const req = makeReq({
      headers: { authorization: "Bearer not-a-real-token" },
    });
    const res = makeRes();
    const next = makeNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("sets req.user and calls next() for a valid token", () => {
    const token = jwt.sign({ id: "curator-1", role: "curator" }, "test-secret");
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();
    const next = makeNext();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ id: "curator-1", role: "curator" });
  });
});

// ─── authorize middleware ─────────────────────────────────────────────────────

describe("authorize middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when user role is not in the allowed list", () => {
    const req = makeReq({ user: { id: "user-1", role: "user" } });
    const res = makeRes();
    const next = makeNext();

    authorize("curator")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 403 }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when req.user is absent", () => {
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    authorize("curator")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when user has a permitted role", () => {
    const req = makeReq({ user: { id: "curator-1", role: "curator" } });
    const res = makeRes();
    const next = makeNext();

    authorize("curator", "admin")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ─── listWorkers ──────────────────────────────────────────────────────────────

describe("listWorkers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns first page in cursor mode when page is absent", async () => {
    (workerService.listWorkersCursor as any).mockResolvedValue({ data: [mockWorker], nextCursor: null });
    const req = makeReq({ query: {} });
    const res = makeRes();

    await listWorkers(req, res);

    expect(workerService.listWorkersCursor).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 }),
    );
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe("success");
    expect(body.code).toBe(200);
    expect(body.nextCursor).toBeNull();
    expect(body.limit).toBe(20);
    expect(body.data).toHaveLength(1);
  });

  it("passes the cursor and limit through to the service", async () => {
    (workerService.listWorkersCursor as any).mockResolvedValue({
      data: [{ ...mockWorker, id: "worker-3" }, { ...mockWorker, id: "worker-4" }],
      nextCursor: "worker-4",
    });
    const req = makeReq({ query: { cursor: "worker-1", limit: "2" } });
    const res = makeRes();

    await listWorkers(req, res);

    expect(workerService.listWorkersCursor).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "worker-1", limit: 2 }),
    );
    const body = res.json.mock.calls[0][0];
    expect(body.data).toHaveLength(2);
    expect(body.nextCursor).toBe("worker-4");
  });

  it("returns null nextCursor on the last cursor page", async () => {
    (workerService.listWorkersCursor as any).mockResolvedValue({
      data: [{ ...mockWorker, id: "worker-9" }],
      nextCursor: null,
    });
    const req = makeReq({ query: { cursor: "worker-8", limit: "2" } });
    const res = makeRes();

    await listWorkers(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.nextCursor).toBeNull();
    expect(body.data).toHaveLength(1);
  });

  it("keeps backward-compatible offset pagination when page is provided", async () => {
    (workerService.listWorkers as any).mockResolvedValue({
      data: [mockWorker],
      meta: { total: 1, page: 2, limit: 20, pages: 1 },
    });
    const req = makeReq({ query: { page: "2", limit: "20" } });
    const res = makeRes();

    await listWorkers(req, res);

    expect(workerService.listWorkers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 20 }),
    );
    const body = res.json.mock.calls[0][0];
    expect(body.meta.page).toBe(2);
    expect(body.data).toHaveLength(1);
  });

  it("passes category filter to the service", async () => {
    (workerService.listWorkers as any).mockResolvedValue({
      data: [mockWorker],
      meta: { total: 1, page: 1, limit: 20, pages: 1 },
    });
    const req = makeReq({ query: { page: "1", category: "cat-1" } });
    const res = makeRes();

    await listWorkers(req, res);

    expect(workerService.listWorkers).toHaveBeenCalledWith(
      expect.objectContaining({ category: "cat-1" }),
    );
  });

  it("passes search term filter to the service", async () => {
    (workerService.listWorkers as any).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, pages: 0 },
    });
    const req = makeReq({ query: { page: "1", search: "plumber" } });
    const res = makeRes();

    await listWorkers(req, res);

    expect(workerService.listWorkers).toHaveBeenCalledWith(
      expect.objectContaining({ search: "plumber" }),
    );
  });
});

// ─── showWorker ───────────────────────────────────────────────────────────────

describe("showWorker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with worker data when the worker exists", async () => {
    (workerService.getWorkerWithPortfolio as any).mockResolvedValue(mockWorker);
    const req = makeReq({ params: { id: "worker-1" } });
    const res = makeRes();

    await showWorker(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe("success");
    expect(body.code).toBe(200);
    expect(body.data).toBeDefined();
    expect(workerService.getWorkerWithPortfolio).toHaveBeenCalledWith("worker-1");
  });

  it("returns 404 when the worker does not exist", async () => {
    (workerService.getWorkerWithPortfolio as any).mockResolvedValue(null);
    const req = makeReq({ params: { id: "ghost-id" } });
    const res = makeRes();

    await showWorker(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", code: 404 }),
    );
  });
});

// ─── createWorker ─────────────────────────────────────────────────────────────

describe("createWorker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 201 with the new worker as an authorized curator", async () => {
    (workerService.createWorkerWithMedia as any).mockResolvedValue(mockWorker);
    const req = makeReq({
      body: { name: "John Smith", categoryId: "cat-1", phone: "555-0100" },
      user: { id: "curator-1", role: "curator" },
    });
    const res = makeRes();

    await createWorker(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe("success");
    expect(body.code).toBe(201);
    expect(workerService.createWorkerWithMedia).toHaveBeenCalledWith(
      expect.objectContaining({ name: "John Smith" }),
      "curator-1",
      undefined,
    );
  });
});

// ─── updateWorker ─────────────────────────────────────────────────────────────

describe("updateWorker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with updated worker data", async () => {
    const updated = { ...mockWorker, name: "Updated Name" };
    (workerService.updateWorkerWithMedia as any).mockResolvedValue(updated);
    const req = makeReq({
      params: { id: "worker-1" },
      body: { name: "Updated Name" },
      user: { id: "curator-1", role: "curator" },
    });
    const res = makeRes();

    await updateWorker(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe("success");
    expect(body.code).toBe(200);
    expect(workerService.updateWorkerWithMedia).toHaveBeenCalledWith(
      "worker-1", { name: "Updated Name" }, undefined, "curator-1",
    );
  });

  it("propagates a 403 the service throws (e.g. a future ownership check)", async () => {
    (workerService.updateWorkerWithMedia as any).mockRejectedValue(
      new AppError("Forbidden", 403),
    );
    const req = makeReq({
      params: { id: "worker-1" },
      body: { name: "Hijack" },
      user: { id: "other-curator", role: "curator" },
    });
    const res = makeRes();

    await updateWorker(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", code: 403 }),
    );
  });

  it("returns 404 when the worker does not exist", async () => {
    (workerService.updateWorkerWithMedia as any).mockRejectedValue(
      new AppError("Not found", 404),
    );
    const req = makeReq({
      params: { id: "ghost-id" },
      body: { name: "Test" },
      user: { id: "curator-1", role: "curator" },
    });
    const res = makeRes();

    await updateWorker(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", code: 404 }),
    );
  });
});

// ─── deleteWorker ─────────────────────────────────────────────────────────────

describe("deleteWorker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 204 on success", async () => {
    (workerService.deleteWorkerWithMedia as any).mockResolvedValue(undefined);
    const req = makeReq({
      params: { id: "worker-1" },
      user: { id: "curator-1", role: "curator" },
    });
    const res = makeRes();

    await deleteWorker(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
    expect(workerService.deleteWorkerWithMedia).toHaveBeenCalledWith("worker-1");
  });

  it("propagates a 403 the service throws (e.g. a future ownership check)", async () => {
    (workerService.deleteWorkerWithMedia as any).mockRejectedValue(
      new AppError("Forbidden", 403),
    );
    const req = makeReq({
      params: { id: "worker-1" },
      user: { id: "other-curator", role: "curator" },
    });
    const res = makeRes();

    await deleteWorker(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", code: 403 }),
    );
  });
});

// ─── toggleActivation ─────────────────────────────────────────────────────────

describe("toggleActivation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with the toggled worker data on success", async () => {
    const toggled = { ...mockWorker, isActive: false };
    (workerService.toggleWorker as any).mockResolvedValue(toggled);
    const req = makeReq({
      params: { id: "worker-1" },
      user: { id: "curator-1", role: "curator" },
    });
    const res = makeRes();

    await toggleActivation(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe("success");
    expect(body.code).toBe(200);
    expect(workerService.toggleWorker).toHaveBeenCalledWith("worker-1");
  });

  it("returns 404 when the worker does not exist", async () => {
    (workerService.toggleWorker as any).mockRejectedValue(
      new AppError("Not found", 404),
    );
    const req = makeReq({
      params: { id: "ghost-id" },
      user: { id: "curator-1", role: "curator" },
    });
    const res = makeRes();

    await toggleActivation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", code: 404 }),
    );
  });
});
