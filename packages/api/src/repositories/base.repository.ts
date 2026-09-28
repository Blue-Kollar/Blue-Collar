/**
 * Generic repository interface.
 * All model-specific repositories extend this contract.
 */
export interface IRepository<T, CreateInput, UpdateInput> {
  findById(id: string): Promise<T | null>
  findAll(opts?: { skip?: number; take?: number }): Promise<T[]>
  create(data: CreateInput): Promise<T>
  update(id: string, data: UpdateInput): Promise<T>
  delete(id: string): Promise<T>
  count(where?: Record<string, unknown>): Promise<number>
}

/**
 * Minimal shape a Prisma model delegate must satisfy to be wrapped by
 * BaseRepository. `db.user`, `db.worker`, `db.bookmark`, etc. all conform
 * to this shape without any adapter code.
 */
export interface PrismaDelegate<T, CreateInput, UpdateInput, WhereInput> {
  findUnique(args: { where: Record<string, unknown> }): Promise<T | null>
  findFirst(args: { where: Record<string, unknown> }): Promise<T | null>
  findMany(args: {
    where?: Record<string, unknown>
    skip?: number
    take?: number
    orderBy?: Record<string, unknown>
  }): Promise<T[]>
  create(args: { data: CreateInput }): Promise<T>
  update(args: { where: Record<string, unknown>; data: UpdateInput | Record<string, unknown> }): Promise<T>
  delete(args: { where: Record<string, unknown> }): Promise<T>
  count(args?: { where?: WhereInput }): Promise<number>
}

export interface BaseRepositoryOptions {
  /**
   * When true, `delete()` sets `deletedAt` instead of issuing a hard DELETE,
   * and `findById`/`findAll` transparently exclude soft-deleted rows.
   * Requires the underlying model to have a nullable `deletedAt` column.
   */
  softDelete?: boolean
  /** Field to sort `findAll` results by descending. Defaults to `createdAt`. */
  defaultSortField?: string
}

/**
 * Base repository implementing the common find/create/update/delete/count
 * boilerplate that was previously copy-pasted across every repository in
 * this directory. Entity repositories should extend this class and add
 * only their entity-specific queries — soft-delete and timestamp handling
 * is centralized here so it can't drift between entities.
 */
export abstract class BaseRepository<
  T,
  CreateInput,
  UpdateInput,
  WhereInput = Record<string, unknown>,
> implements IRepository<T, CreateInput, UpdateInput>
{
  protected readonly softDelete: boolean
  protected readonly defaultSortField: string

  constructor(
    protected readonly delegate: PrismaDelegate<T, CreateInput, UpdateInput, WhereInput>,
    options: BaseRepositoryOptions = {},
  ) {
    this.softDelete = options.softDelete ?? false
    this.defaultSortField = options.defaultSortField ?? 'createdAt'
  }

  /** Excludes soft-deleted rows when the model supports soft-delete. */
  protected notDeletedFilter(): Record<string, unknown> {
    return this.softDelete ? { deletedAt: null } : {}
  }

  async findById(id: string): Promise<T | null> {
    if (this.softDelete) {
      return this.delegate.findFirst({ where: { id, ...this.notDeletedFilter() } })
    }
    return this.delegate.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<T[]> {
    return this.delegate.findMany({
      skip: opts.skip,
      take: opts.take,
      where: this.notDeletedFilter(),
      orderBy: { [this.defaultSortField]: 'desc' },
    })
  }

  async create(data: CreateInput): Promise<T> {
    return this.delegate.create({ data })
  }

  /**
   * Stamps `updatedAt` on every write so entities can't drift out of sync
   * when a caller forgets to set it explicitly — this was the class of bug
   * this base class exists to eliminate.
   */
  async update(id: string, data: UpdateInput): Promise<T> {
    return this.delegate.update({
      where: { id },
      data: { ...(data as Record<string, unknown>), updatedAt: new Date() },
    })
  }

  async delete(id: string): Promise<T> {
    if (this.softDelete) {
      return this.delegate.update({ where: { id }, data: { deletedAt: new Date() } })
    }
    return this.delegate.delete({ where: { id } })
  }

  async count(where?: WhereInput): Promise<number> {
    return this.delegate.count({ where })
  }
}
