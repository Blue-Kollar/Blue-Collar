/**
 * db.integration.test.ts — Real database integration tests
 *
 * These tests exercise actual Prisma operations against a live PostgreSQL
 * database. They validate that the application's persistence layer works
 * correctly with the real database engine.
 *
 * Covers:
 * - User CRUD operations
 * - Category CRUD operations
 * - Worker CRUD with foreign keys
 * - Unique constraints (email, etc.)
 * - Required field constraints
 * - Relationships (User → Worker, Worker → Category)
 * - Query filters and ordering
 * - Transaction behavior
 * - Soft delete (deletedAt)
 *
 * Setup: Requires TEST_DATABASE_URL pointing at a disposable test database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db, TEST_DB_URL } from './setup.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

let locationId: string
let categoryId: string
let userId: string

beforeAll(async () => {
  // Create prerequisite data for tests that need relationships
  const location = await db.location.create({
    data: {
      city: 'Testville',
      state: 'TS',
      country: 'Testland',
      lat: 40.7128,
      lng: -74.006,
    },
  })
  locationId = location.id

  const category = await db.category.create({
    data: {
      name: 'Test Plumbing',
      description: 'Test category for plumbing',
    },
  })
  categoryId = category.id
})

afterAll(async () => {
  // Final cleanup
  await db.$executeRawUnsafe('DELETE FROM "Worker"')
  await db.$executeRawUnsafe('DELETE FROM "User"')
  await db.$executeRawUnsafe('DELETE FROM "Category"')
  await db.$executeRawUnsafe('DELETE FROM "Location"')
})

// ── Database Connection ────────────────────────────────────────────────────────

describe('Database connection', () => {
  it('connects to the test database', async () => {
    expect(TEST_DB_URL).toBeDefined()
    // Simple query to verify connection
    const result = await db.$queryRaw`SELECT 1 as alive`
    expect(result).toEqual([{ alive: 1 }])
  })

  it('runs against the correct database (not production)', () => {
    expect(TEST_DB_URL).not.toContain('bluecollar_prod')
    expect(TEST_DB_URL).not.toContain('production')
  })
})

// ── User CRUD ──────────────────────────────────────────────────────────────────

describe('User CRUD operations', () => {
  it('creates a user with all required fields', async () => {
    const user = await db.user.create({
      data: {
        email: 'crud-test@example.com',
        firstName: 'Crud',
        lastName: 'Tester',
        role: 'user',
      },
    })

    expect(user).toBeDefined()
    expect(user.id).toBeDefined()
    expect(user.email).toBe('crud-test@example.com')
    expect(user.firstName).toBe('Crud')
    expect(user.lastName).toBe('Tester')
    expect(user.role).toBe('user')
    expect(user.verified).toBe(false)
    expect(user.createdAt).toBeInstanceOf(Date)
    expect(user.updatedAt).toBeInstanceOf(Date)
  })

  it('retrieves a user by id', async () => {
    const created = await db.user.create({
      data: {
        email: 'retrieve-test@example.com',
        firstName: 'Retrieve',
        lastName: 'Tester',
        role: 'user',
      },
    })

    const found = await db.user.findUnique({ where: { id: created.id } })

    expect(found).not.toBeNull()
    expect(found!.email).toBe('retrieve-test@example.com')
    expect(found!.firstName).toBe('Retrieve')
  })

  it('retrieves a user by email (unique field)', async () => {
    await db.user.create({
      data: {
        email: 'unique-lookup@example.com',
        firstName: 'Lookup',
        lastName: 'Tester',
        role: 'curator',
      },
    })

    const found = await db.user.findUnique({
      where: { email: 'unique-lookup@example.com' },
    })

    expect(found).not.toBeNull()
    expect(found!.role).toBe('curator')
  })

  it('updates a user record', async () => {
    const user = await db.user.create({
      data: {
        email: 'update-test@example.com',
        firstName: 'Old',
        lastName: 'Name',
        role: 'user',
      },
    })

    const updated = await db.user.update({
      where: { id: user.id },
      data: { firstName: 'New', lastName: 'Updated' },
    })

    expect(updated.firstName).toBe('New')
    expect(updated.lastName).toBe('Updated')
    expect(updated.email).toBe('update-test@example.com')
  })

  it('soft-deletes a user (sets deletedAt)', async () => {
    const user = await db.user.create({
      data: {
        email: 'soft-delete-test@example.com',
        firstName: 'Delete',
        lastName: 'Me',
        role: 'user',
      },
    })

    expect(user.deletedAt).toBeNull()

    const softDeleted = await db.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    })

    expect(softDeleted.deletedAt).not.toBeNull()
  })

  it('hard-deletes a user', async () => {
    const user = await db.user.create({
      data: {
        email: 'hard-delete-test@example.com',
        firstName: 'Hard',
        lastName: 'Delete',
        role: 'user',
      },
    })

    await db.user.delete({ where: { id: user.id } })

    const found = await db.user.findUnique({ where: { id: user.id } })
    expect(found).toBeNull()
  })
})

// ── User Constraints ───────────────────────────────────────────────────────────

describe('User constraints', () => {
  it('enforces unique email constraint', async () => {
    await db.user.create({
      data: {
        email: 'duplicate@example.com',
        firstName: 'First',
        lastName: 'User',
        role: 'user',
      },
    })

    await expect(
      db.user.create({
        data: {
          email: 'duplicate@example.com',
          firstName: 'Second',
          lastName: 'User',
          role: 'user',
        },
      }),
    ).rejects.toThrow()
  })

  it('enforces required email field', async () => {
    await expect(
      db.user.create({
        data: {
          email: '',
          firstName: 'No',
          lastName: 'Email',
          role: 'user',
        },
      }),
    ).rejects.toThrow()
  })

  it('enforces required firstName field', async () => {
    await expect(
      db.user.create({
        data: {
          email: 'no-firstname@example.com',
          firstName: '',
          lastName: 'Tester',
          role: 'user',
        },
      }),
    ).rejects.toThrow()
  })

  it('defaults role to "user" when not specified', async () => {
    const user = await db.user.create({
      data: {
        email: 'default-role@example.com',
        firstName: 'Default',
        lastName: 'Role',
      },
    })

    expect(user.role).toBe('user')
  })

  it('defaults verified to false', async () => {
    const user = await db.user.create({
      data: {
        email: 'unverified@example.com',
        firstName: 'Unverified',
        lastName: 'User',
      },
    })

    expect(user.verified).toBe(false)
  })
})

// ── Category CRUD ──────────────────────────────────────────────────────────────

describe('Category CRUD operations', () => {
  it('creates a category', async () => {
    const category = await db.category.create({
      data: {
        name: 'Electrician',
        description: 'Electrical services',
        icon: '⚡',
      },
    })

    expect(category).toBeDefined()
    expect(category.name).toBe('Electrician')
    expect(category.description).toBe('Electrical services')
    expect(category.icon).toBe('⚡')
  })

  it('enforces unique category name', async () => {
    await db.category.create({
      data: { name: 'Plumbing' },
    })

    await expect(
      db.category.create({
        data: { name: 'Plumbing' },
      }),
    ).rejects.toThrow()
  })

  it('retrieves all categories', async () => {
    await db.category.create({ data: { name: 'Carpentry' } })
    await db.category.create({ data: { name: 'Painting' } })

    const categories = await db.category.findMany()
    expect(categories.length).toBeGreaterThanOrEqual(2)
  })

  it('deletes a category', async () => {
    const category = await db.category.create({
      data: { name: 'To Be Deleted' },
    })

    await db.category.delete({ where: { id: category.id } })

    const found = await db.category.findUnique({ where: { id: category.id } })
    expect(found).toBeNull()
  })
})

// ── Worker CRUD with Relationships ─────────────────────────────────────────────

describe('Worker CRUD with relationships', () => {
  it('creates a worker linked to a user and category', async () => {
    const user = await db.user.create({
      data: {
        email: 'worker-owner@example.com',
        firstName: 'Worker',
        lastName: 'Owner',
        role: 'curator',
      },
    })

    const worker = await db.worker.create({
      data: {
        name: 'Test Worker',
        bio: 'A skilled worker',
        categoryId: categoryId,
        curatorId: user.id,
        locationId: locationId,
        isActive: true,
      },
    })

    expect(worker).toBeDefined()
    expect(worker.name).toBe('Test Worker')
    expect(worker.categoryId).toBe(categoryId)
    expect(worker.curatorId).toBe(user.id)
    expect(worker.locationId).toBe(locationId)
    expect(worker.isActive).toBe(true)
  })

  it('retrieves a worker with its category relation', async () => {
    const user = await db.user.create({
      data: {
        email: 'relation-test@example.com',
        firstName: 'Relation',
        lastName: 'Tester',
        role: 'curator',
      },
    })

    const worker = await db.worker.create({
      data: {
        name: 'Related Worker',
        categoryId: categoryId,
        curatorId: user.id,
      },
    })

    const found = await db.worker.findUnique({
      where: { id: worker.id },
      include: { category: true },
    })

    expect(found).not.toBeNull()
    expect(found!.category).toBeDefined()
    expect(found!.category.name).toBe('Test Plumbing')
  })

  it('retrieves a worker with its curator (user) relation', async () => {
    const user = await db.user.create({
      data: {
        email: 'curator-relation@example.com',
        firstName: 'Curator',
        lastName: 'Tester',
        role: 'curator',
      },
    })

    const worker = await db.worker.create({
      data: {
        name: 'Curator Worker',
        categoryId: categoryId,
        curatorId: user.id,
      },
    })

    const found = await db.worker.findUnique({
      where: { id: worker.id },
      include: { curator: true },
    })

    expect(found).not.toBeNull()
    expect(found!.curator).toBeDefined()
    expect(found!.curator.email).toBe('curator-relation@example.com')
  })

  it('enforces foreign key constraint on categoryId', async () => {
    const user = await db.user.create({
      data: {
        email: 'fk-test@example.com',
        firstName: 'FK',
        lastName: 'Test',
        role: 'curator',
      },
    })

    await expect(
      db.worker.create({
        data: {
          name: 'FK Worker',
          categoryId: 'non-existent-category-id',
          curatorId: user.id,
        },
      }),
    ).rejects.toThrow()
  })

  it('enforces foreign key constraint on curatorId', async () => {
    await expect(
      db.worker.create({
        data: {
          name: 'Orphan Worker',
          categoryId: categoryId,
          curatorId: 'non-existent-user-id',
        },
      }),
    ).rejects.toThrow()
  })

  it('defaults isActive to true', async () => {
    const user = await db.user.create({
      data: {
        email: 'active-default@example.com',
        firstName: 'Active',
        lastName: 'Default',
        role: 'curator',
      },
    })

    const worker = await db.worker.create({
      data: {
        name: 'Active Worker',
        categoryId: categoryId,
        curatorId: user.id,
      },
    })

    expect(worker.isActive).toBe(true)
  })

  it('can toggle isActive', async () => {
    const user = await db.user.create({
      data: {
        email: 'toggle-active@example.com',
        firstName: 'Toggle',
        lastName: 'Active',
        role: 'curator',
      },
    })

    const worker = await db.worker.create({
      data: {
        name: 'Toggle Worker',
        categoryId: categoryId,
        curatorId: user.id,
        isActive: true,
      },
    })

    const deactivated = await db.worker.update({
      where: { id: worker.id },
      data: { isActive: false },
    })

    expect(deactivated.isActive).toBe(false)
  })
})

// ── Query Filters & Ordering ───────────────────────────────────────────────────

describe('Query filters and ordering', () => {
  it('filters workers by isActive', async () => {
    const user = await db.user.create({
      data: {
        email: 'filter-test@example.com',
        firstName: 'Filter',
        lastName: 'Tester',
        role: 'curator',
      },
    })

    await db.worker.create({
      data: {
        name: 'Active Worker',
        categoryId: categoryId,
        curatorId: user.id,
        isActive: true,
      },
    })

    await db.worker.create({
      data: {
        name: 'Inactive Worker',
        categoryId: categoryId,
        curatorId: user.id,
        isActive: false,
      },
    })

    const activeWorkers = await db.worker.findMany({
      where: { isActive: true },
    })

    expect(activeWorkers.every((w) => w.isActive)).toBe(true)
  })

  it('filters workers by categoryId', async () => {
    const user = await db.user.create({
      data: {
        email: 'cat-filter@example.com',
        firstName: 'Cat',
        lastName: 'Filter',
        role: 'curator',
      },
    })

    const otherCategory = await db.category.create({
      data: { name: 'Unique Filter Cat' },
    })

    await db.worker.create({
      data: {
        name: 'Plumbing Worker',
        categoryId: categoryId,
        curatorId: user.id,
      },
    })

    await db.worker.create({
      data: {
        name: 'Electric Worker',
        categoryId: otherCategory.id,
        curatorId: user.id,
      },
    })

    const plumbingWorkers = await db.worker.findMany({
      where: { categoryId },
    })

    expect(plumbingWorkers.every((w) => w.categoryId === categoryId)).toBe(true)
  })

  it('orders users by createdAt', async () => {
    const user1 = await db.user.create({
      data: {
        email: 'order-1@example.com',
        firstName: 'First',
        lastName: 'User',
      },
    })

    const user2 = await db.user.create({
      data: {
        email: 'order-2@example.com',
        firstName: 'Second',
        lastName: 'User',
      },
    })

    const users = await db.user.findMany({
      orderBy: { createdAt: 'asc' },
      where: {
        email: { in: ['order-1@example.com', 'order-2@example.com'] },
      },
    })

    expect(users).toHaveLength(2)
    expect(users[0]!.id).toBe(user1.id)
    expect(users[1]!.id).toBe(user2.id)
  })

  it('supports pagination with take and skip', async () => {
    const user = await db.user.create({
      data: {
        email: 'paginate@example.com',
        firstName: 'Paginate',
        lastName: 'Tester',
        role: 'curator',
      },
    })

    // Create 5 workers
    for (let i = 0; i < 5; i++) {
      await db.worker.create({
        data: {
          name: `Page Worker ${i}`,
          categoryId: categoryId,
          curatorId: user.id,
        },
      })
    }

    const page1 = await db.worker.findMany({
      where: { curatorId: user.id },
      orderBy: { createdAt: 'asc' },
      take: 2,
      skip: 0,
    })

    const page2 = await db.worker.findMany({
      where: { curatorId: user.id },
      orderBy: { createdAt: 'asc' },
      take: 2,
      skip: 2,
    })

    expect(page1).toHaveLength(2)
    expect(page2).toHaveLength(2)
    expect(page1[0]!.id).not.toBe(page2[0]!.id)
  })
})

// ── Transaction Behavior ───────────────────────────────────────────────────────

describe('Transaction behavior', () => {
  it('commits a transaction on success', async () => {
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: 'tx-commit@example.com',
          firstName: 'TX',
          lastName: 'Commit',
        },
      })

      const worker = await tx.worker.create({
        data: {
          name: 'TX Worker',
          categoryId: categoryId,
          curatorId: user.id,
        },
      })

      return { user, worker }
    })

    expect(result.user).toBeDefined()
    expect(result.worker).toBeDefined()

    // Verify both records exist
    const foundUser = await db.user.findUnique({ where: { id: result.user.id } })
    const foundWorker = await db.worker.findUnique({ where: { id: result.worker.id } })
    expect(foundUser).not.toBeNull()
    expect(foundWorker).not.toBeNull()
  })

  it('rolls back a transaction on failure', async () => {
    let userCountBefore: number

    try {
      userCountBefore = (await db.user.findMany()).length

      await db.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            email: 'tx-rollback@example.com',
            firstName: 'TX',
            lastName: 'Rollback',
          },
        })

        // Force an error to trigger rollback
        throw new Error('Intentional rollback')
      })
    } catch {
      // Expected — transaction should have rolled back
    }

    const userCountAfter = (await db.user.findMany()).length
    expect(userCountAfter).toBe(userCountBefore!)
  })
})

// ── Timestamps ─────────────────────────────────────────────────────────────────

describe('Timestamp behavior', () => {
  it('auto-generates createdAt and updatedAt on create', async () => {
    const before = new Date()
    const user = await db.user.create({
      data: {
        email: 'timestamps@example.com',
        firstName: 'Timestamp',
        lastName: 'Test',
      },
    })
    const after = new Date()

    expect(user.createdAt).toBeInstanceOf(Date)
    expect(user.updatedAt).toBeInstanceOf(Date)
    expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(user.createdAt.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('auto-updates updatedAt on update', async () => {
    const user = await db.user.create({
      data: {
        email: 'updated-at@example.com',
        firstName: 'Update',
        lastName: 'Test',
      },
    })

    const originalUpdatedAt = user.updatedAt

    // Small delay to ensure timestamp differs
    await new Promise((resolve) => setTimeout(resolve, 50))

    const updated = await db.user.update({
      where: { id: user.id },
      data: { firstName: 'Updated' },
    })

    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime())
  })
})

// ── Optional Fields ────────────────────────────────────────────────────────────

describe('Optional fields', () => {
  it('allows null for optional fields', async () => {
    const user = await db.user.create({
      data: {
        email: 'optional-nulls@example.com',
        firstName: 'Optional',
        lastName: 'Nulls',
        phone: null,
        avatar: null,
        bio: null,
        walletAddress: null,
        locationId: null,
      },
    })

    expect(user.phone).toBeNull()
    expect(user.avatar).toBeNull()
    expect(user.bio).toBeNull()
    expect(user.walletAddress).toBeNull()
    expect(user.locationId).toBeNull()
  })

  it('allows setting optional fields', async () => {
    const user = await db.user.create({
      data: {
        email: 'optional-set@example.com',
        firstName: 'Optional',
        lastName: 'Set',
        phone: '+1234567890',
        avatar: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
      },
    })

    expect(user.phone).toBe('+1234567890')
    expect(user.avatar).toBe('https://example.com/avatar.jpg')
    expect(user.bio).toBe('Test bio')
  })
})
