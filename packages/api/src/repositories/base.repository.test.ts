import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseRepository, type PrismaDelegate } from './base.repository.js';

interface Entity {
  id: string;
  name: string;
  deletedAt: Date | null;
  updatedAt: Date;
}

function createMockDelegate(): PrismaDelegate<
  Entity,
  { name: string },
  { name?: string },
  Record<string, unknown>
> {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };
}

class HardDeleteRepository extends BaseRepository<Entity, { name: string }, { name?: string }> {
  constructor(
    delegate: PrismaDelegate<Entity, { name: string }, { name?: string }, Record<string, unknown>>,
  ) {
    super(delegate);
  }
}

class SoftDeleteRepository extends BaseRepository<Entity, { name: string }, { name?: string }> {
  constructor(
    delegate: PrismaDelegate<Entity, { name: string }, { name?: string }, Record<string, unknown>>,
  ) {
    super(delegate, { softDelete: true });
  }
}

describe('BaseRepository', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hard-delete mode', () => {
    let delegate: ReturnType<typeof createMockDelegate>;
    let repo: HardDeleteRepository;

    beforeEach(() => {
      delegate = createMockDelegate();
      repo = new HardDeleteRepository(delegate);
    });

    it('findById uses findUnique (no deletedAt filter)', async () => {
      await repo.findById('1');
      expect(delegate.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(delegate.findFirst).not.toHaveBeenCalled();
    });

    it('findAll queries without a deletedAt filter', async () => {
      await repo.findAll({ skip: 0, take: 10 });
      expect(delegate.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: {},
        orderBy: { createdAt: 'desc' },
      });
    });

    it('delete issues a hard delete, not a soft-delete update', async () => {
      await repo.delete('1');
      expect(delegate.delete).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(delegate.update).not.toHaveBeenCalled();
    });
  });

  describe('soft-delete mode', () => {
    let delegate: ReturnType<typeof createMockDelegate>;
    let repo: SoftDeleteRepository;

    beforeEach(() => {
      delegate = createMockDelegate();
      repo = new SoftDeleteRepository(delegate);
    });

    it('findById excludes soft-deleted rows via findFirst', async () => {
      await repo.findById('1');
      expect(delegate.findFirst).toHaveBeenCalledWith({ where: { id: '1', deletedAt: null } });
      expect(delegate.findUnique).not.toHaveBeenCalled();
    });

    it('findAll excludes soft-deleted rows', async () => {
      await repo.findAll();
      expect(delegate.findMany).toHaveBeenCalledWith({
        skip: undefined,
        take: undefined,
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('delete sets deletedAt instead of issuing a hard DELETE', async () => {
      const fixedNow = new Date('2026-01-15T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);

      await repo.delete('1');
      expect(delegate.delete).not.toHaveBeenCalled();
      expect(delegate.update).toHaveBeenCalledTimes(1);
      const call = vi.mocked(delegate.update).mock.calls[0]![0] as {
        where: unknown;
        data: { deletedAt: Date };
      };
      expect(call.where).toEqual({ id: '1' });
      expect(call.data.deletedAt).toBeInstanceOf(Date);
      expect(call.data.deletedAt.getTime()).toBe(fixedNow.getTime());
    });
  });

  describe('timestamp behavior (shared across modes)', () => {
    it('update() always stamps updatedAt, even if the caller omits it', async () => {
      const delegate = createMockDelegate();
      const repo = new HardDeleteRepository(delegate);

      const fixedNow = new Date('2026-01-15T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);

      await repo.update('1', { name: 'new name' });

      expect(delegate.update).toHaveBeenCalledTimes(1);
      const call = vi.mocked(delegate.update).mock.calls[0]![0] as {
        where: unknown;
        data: { name: string; updatedAt: Date };
      };
      expect(call.where).toEqual({ id: '1' });
      expect(call.data.name).toBe('new name');
      expect(call.data.updatedAt).toBeInstanceOf(Date);
      expect(call.data.updatedAt.getTime()).toBe(fixedNow.getTime());
    });

    it('create() and count() pass through to the delegate unchanged', async () => {
      const delegate = createMockDelegate();
      const repo = new HardDeleteRepository(delegate);

      await repo.create({ name: 'x' });
      expect(delegate.create).toHaveBeenCalledWith({ data: { name: 'x' } });

      await repo.count({ name: 'x' });
      expect(delegate.count).toHaveBeenCalledWith({ where: { name: 'x' } });
    });
  });
});
