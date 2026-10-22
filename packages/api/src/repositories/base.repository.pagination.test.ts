/**
 * base.repository.pagination.test.ts — unit tests for pagination and the
 * soft-delete filter in BaseRepository (#1583).
 *
 * Covers:
 *  - findAll forwards skip/take to the delegate and defaults to no paging
 *  - findAll sorts by defaultSortField (descending), defaulting to createdAt
 *  - findAll applies the deletedAt filter only in soft-delete mode
 *  - notDeletedFilter returns the soft-delete predicate only when enabled
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseRepository, type PrismaDelegate } from './base.repository.js';

interface Entity {
  id: string;
  name: string;
  deletedAt: Date | null;
  updatedAt: Date;
}

type Delegate = PrismaDelegate<
  Entity,
  { name: string },
  { name?: string },
  Record<string, unknown>
>;

function createMockDelegate(): Delegate {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };
}

class PlainRepository extends BaseRepository<Entity, { name: string }, { name?: string }> {}

class SoftDeleteRepository extends BaseRepository<Entity, { name: string }, { name?: string }> {
  constructor(delegate: Delegate) {
    super(delegate, { softDelete: true });
  }
}

class NameSortedRepository extends BaseRepository<Entity, { name: string }, { name?: string }> {
  constructor(delegate: Delegate) {
    super(delegate, { softDelete: true, defaultSortField: 'name' });
  }
}

describe('BaseRepository pagination', () => {
  let delegate: Delegate;

  beforeEach(() => {
    delegate = createMockDelegate();
  });

  it('passes skip and take through to findMany', async () => {
    const repo = new PlainRepository(delegate);

    await repo.findAll({ skip: 20, take: 10 });

    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
  });

  it('leaves skip and take undefined when no paging options are given', async () => {
    const repo = new PlainRepository(delegate);

    await repo.findAll();

    const args = vi.mocked(delegate.findMany).mock.calls[0][0];
    expect(args.skip).toBeUndefined();
    expect(args.take).toBeUndefined();
  });

  it('returns the page of rows the delegate resolves with', async () => {
    const rows: Entity[] = [{ id: '1', name: 'a', deletedAt: null, updatedAt: new Date() }];
    vi.mocked(delegate.findMany).mockResolvedValueOnce(rows);
    const repo = new PlainRepository(delegate);

    await expect(repo.findAll({ skip: 0, take: 1 })).resolves.toEqual(rows);
  });

  it('sorts by createdAt descending by default', async () => {
    const repo = new PlainRepository(delegate);

    await repo.findAll();

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  it('sorts by the configured defaultSortField', async () => {
    const repo = new NameSortedRepository(delegate);

    await repo.findAll();

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'desc' } }),
    );
  });
});

describe('BaseRepository soft-delete filter', () => {
  let delegate: Delegate;

  beforeEach(() => {
    delegate = createMockDelegate();
  });

  it('findAll excludes soft-deleted rows when softDelete is enabled', async () => {
    const repo = new SoftDeleteRepository(delegate);

    await repo.findAll({ skip: 0, take: 5 });

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null }, skip: 0, take: 5 }),
    );
  });

  it('findAll applies an empty where clause when softDelete is disabled', async () => {
    const repo = new PlainRepository(delegate);

    await repo.findAll();

    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('notDeletedFilter returns the deletedAt predicate only in soft-delete mode', () => {
    const soft = new SoftDeleteRepository(delegate);
    const hard = new PlainRepository(delegate);

    expect(soft['notDeletedFilter']()).toEqual({ deletedAt: null });
    expect(hard['notDeletedFilter']()).toEqual({});
  });
});
