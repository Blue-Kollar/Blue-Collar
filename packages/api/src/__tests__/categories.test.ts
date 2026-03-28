/**
 * Unit tests for the categories controller (src/controllers/categories.ts).
 * The category service is mocked; no real DB calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../services/AppError.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../services/category.service.js", () => ({
  listCategories: vi.fn(),
  getCategory: vi.fn(),
}));

// Pass categories through unchanged so tests assert on the raw mock data
vi.mock("../resources/index.js", () => ({
  CategoryResource: vi.fn((c: unknown) => c),
  CategoryCollection: vi.fn((cs: unknown[]) => cs),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import * as categoryService from "../services/category.service.js";
import { listCategories, getCategory } from "../controllers/categories.js";
import { categoryFactory } from "./factories/category.factory.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function makeReq(overrides: Record<string, any> = {}): any {
  return { params: {}, ...overrides };
}

const mockCategory = categoryFactory({
  id: "cat-1",
  name: "Plumbing",
  description: "Fix pipes",
});

// ─── listCategories ───────────────────────────────────────────────────────────

describe("listCategories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all categories with a 200 status", async () => {
    (categoryService.listCategories as any).mockResolvedValue([mockCategory]);
    const req = makeReq();
    const res = makeRes();

    await listCategories(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe("success");
    expect(body.code).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Plumbing");
  });

  it("returns an empty array when no categories exist", async () => {
    (categoryService.listCategories as any).mockResolvedValue([]);
    const req = makeReq();
    const res = makeRes();

    await listCategories(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe("success");
    expect(body.data).toHaveLength(0);
  });
});

// ─── getCategory ──────────────────────────────────────────────────────────────

describe("getCategory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with category data when the category exists", async () => {
    (categoryService.getCategory as any).mockResolvedValue(mockCategory);
    const req = makeReq({ params: { id: "cat-1" } });
    const res = makeRes();

    await getCategory(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe("success");
    expect(body.code).toBe(200);
    expect(body.data).toBeDefined();
    expect(categoryService.getCategory).toHaveBeenCalledWith("cat-1");
  });

  it("returns 404 when the category does not exist", async () => {
    (categoryService.getCategory as any).mockRejectedValue(
      new AppError("Not found", 404),
    );
    const req = makeReq({ params: { id: "ghost-id" } });
    const res = makeRes();

    await getCategory(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", code: 404 }),
    );
  });
});
