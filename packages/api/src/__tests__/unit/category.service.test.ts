// Closes #1855

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../db.js', () => ({
  db: {
    category: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../utils/date.js', () => ({
  nowUtc: vi.fn(() => new Date()),
  parseUtcDate: vi.fn((s: string) => new Date(s)),
  addUtcMs: vi.fn((d: Date, ms: number) => new Date(d.getTime() + ms)),
  formatUtcIso: vi.fn((d: Date) => d.toISOString()),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { createCategoryService } from '../../services/category.service.js';
import { db } from '../../db.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

type Category = {
  id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Plumbing',
    icon: '🔧',
    description: 'Plumbing services',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/** Build a minimal fake category repository. */
function makeRepo() {
  return {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('category.service', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: ReturnType<typeof createCategoryService>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = makeRepo();
    service = createCategoryService({
      categoryRepository: repo as never,
      db: db as never,
    });
  });

  // ── listCategories ─────────────────────────────────────────────────────────

  describe('listCategories', () => {
    it('returns all categories from repo.findAll', async () => {
      const categories = [makeCategory(), makeCategory({ id: 'cat-2', name: 'Electrical' })];
      repo.findAll.mockResolvedValueOnce(categories);

      const result = await service.listCategories();

      expect(result).toEqual(categories);
      expect(repo.findAll).toHaveBeenCalledOnce();
    });
  });

  // ── listCategoriesWithPagination ───────────────────────────────────────────

  describe('listCategoriesWithPagination', () => {
    it('returns [categories, total] tuple', async () => {
      const categories = [makeCategory()];
      vi.mocked(db.category.findMany).mockResolvedValueOnce(categories as never);
      vi.mocked(db.category.count).mockResolvedValueOnce(42);

      const [cats, total] = await service.listCategoriesWithPagination(0, 10);

      expect(cats).toEqual(categories);
      expect(total).toBe(42);
      expect(db.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });
  });

  // ── getCategory ────────────────────────────────────────────────────────────

  describe('getCategory', () => {
    it('returns the category when found', async () => {
      const category = makeCategory();
      repo.findById.mockResolvedValueOnce(category);

      const result = await service.getCategory('cat-1');

      expect(result).toEqual(category);
    });

    it('throws 404 when category does not exist', async () => {
      repo.findById.mockResolvedValueOnce(null);

      await expect(service.getCategory('ghost-cat')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ── createCategory ─────────────────────────────────────────────────────────

  describe('createCategory', () => {
    it('creates a category successfully', async () => {
      repo.findByName.mockResolvedValueOnce(null);
      const created = makeCategory();
      repo.create.mockResolvedValueOnce(created);

      const result = await service.createCategory({ name: 'Plumbing', icon: '🔧' });

      expect(result).toEqual(created);
      expect(repo.create).toHaveBeenCalledWith({ name: 'Plumbing', icon: '🔧' });
    });

    it('throws 409 when a category with that name already exists', async () => {
      repo.findByName.mockResolvedValueOnce(makeCategory());

      await expect(service.createCategory({ name: 'Plumbing' })).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  // ── updateCategory ─────────────────────────────────────────────────────────

  describe('updateCategory', () => {
    it('updates a category successfully', async () => {
      const existing = makeCategory();
      repo.findById.mockResolvedValueOnce(existing);
      const updated = makeCategory({ name: 'Plumbing Pro' });
      repo.update.mockResolvedValueOnce(updated);

      const result = await service.updateCategory('cat-1', { name: 'Plumbing Pro' });

      expect(result).toEqual(updated);
      expect(repo.update).toHaveBeenCalledWith('cat-1', { name: 'Plumbing Pro' });
    });

    it('throws 404 when the category does not exist', async () => {
      repo.findById.mockResolvedValueOnce(null);

      await expect(service.updateCategory('ghost-cat', { name: 'Ghost' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // ── deleteCategory ─────────────────────────────────────────────────────────

  describe('deleteCategory', () => {
    it('deletes a category successfully', async () => {
      const existing = makeCategory();
      repo.findById.mockResolvedValueOnce(existing);
      repo.delete.mockResolvedValueOnce(existing);

      const result = await service.deleteCategory('cat-1');

      expect(result).toEqual(existing);
      expect(repo.delete).toHaveBeenCalledWith('cat-1');
    });

    it('throws 404 when the category does not exist', async () => {
      repo.findById.mockResolvedValueOnce(null);

      await expect(service.deleteCategory('ghost-cat')).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
