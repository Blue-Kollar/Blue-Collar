/**
 * db-fixtures.ts — Database fixture factories for integration tests
 *
 * Provides factory functions to generate realistic test data for common domain models:
 * - StellarAccount: mock cryptocurrency wallet accounts with balance & sequence tracking
 * - WebhookSubscription: mock webhook endpoints with event subscriptions & secrets
 * - WebhookLog: mock webhook delivery logs with retry tracking
 * - Booking: mock service booking requests with time & description fields
 * - EscrowRecord: mock escrow transactions with payment status tracking
 *
 * Each factory accepts partial overrides for flexible test setup.
 * Usage:
 *   const account = await createStellarAccount(db, { balance: 1000 })
 *   const subscription = await createWebhookSubscription(db, { events: ['payment.created'] })
 *   const booking = await createBooking(db, { workerId, requesterId })
 *
 * IMPORTANT: All factories require a Prisma client (db) and must be called
 * in a transactional context or with a test database configured.
 */

import { faker } from '@faker-js/faker'

/**
 * Minimal structural type for the Prisma client used by these factories.
 * Declaring it locally keeps test-utils importable in packages that do not
 * have `@prisma/client` installed, while a real PrismaClient remains assignable.
 */
export interface PrismaFixtureClient {
  user: any
  stellarAccount: any
  webhookSubscription: any
  webhookLog: any
  worker: any
  category: any
  booking: any
  escrowRecord: any
}

/**
 * Create a StellarAccount fixture with optional overrides.
 *
 * @param db - Prisma client instance
 * @param overrides - Partial StellarAccount data to override defaults
 * @returns Created StellarAccount record
 *
 * Example:
 *   const account = await createStellarAccount(db, {
 *     publicKey: 'GXXXXXXXXXX...',
 *     balance: 1000.5
 *   })
 */
export async function createStellarAccount(
  db: PrismaFixtureClient,
  overrides: Partial<{
    userId: string
    publicKey: string
    balance: number
    sequences: bigint | number
  }> = {},
) {
  const { userId: defaultUserId, ...rest } = overrides

  // Create user if userId not provided
  let userId = overrides.userId
  if (!userId) {
    const user = await db.user.create({
      data: {
        email: faker.internet.email(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        password: 'hashed_password_placeholder',
      },
    })
    userId = user.id
  }

  return db.stellarAccount.create({
    data: {
      userId,
      publicKey: faker.string.alphanumeric(56), // Stellar public key format (~56 chars)
      balance: 100, // Default balance in XLM
      sequences: BigInt(0),
      ...rest,
    },
  })
}

/**
 * Create a WebhookSubscription fixture with optional overrides.
 *
 * @param db - Prisma client instance
 * @param overrides - Partial WebhookSubscription data to override defaults
 * @returns Created WebhookSubscription record
 *
 * Example:
 *   const subscription = await createWebhookSubscription(db, {
 *     url: 'https://example.com/webhooks/payment',
 *     events: ['payment.created', 'payment.completed']
 *   })
 */
export async function createWebhookSubscription(
  db: PrismaFixtureClient,
  overrides: Partial<{
    userId: string
    url: string
    secret: string
    events: string[]
    isActive: boolean
  }> = {},
) {
  // Create user if userId not provided
  let userId = overrides.userId
  if (!userId) {
    const user = await db.user.create({
      data: {
        email: faker.internet.email(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        password: 'hashed_password_placeholder',
      },
    })
    userId = user.id
  }

  return db.webhookSubscription.create({
    data: {
      url: faker.internet.url(),
      secret: faker.string.hexadecimal({ length: 64 }), // 32 bytes in hex = 64 chars
      events: ['payment.created', 'payment.completed'],
      isActive: true,
      ...overrides,
      userId, // Ensure userId is set from the variable
    },
  })
}

/**
 * Create a WebhookLog fixture with optional overrides.
 *
 * @param db - Prisma client instance
 * @param subscriptionId - ID of the parent WebhookSubscription
 * @param overrides - Partial WebhookLog data to override defaults
 * @returns Created WebhookLog record
 *
 * Example:
 *   const log = await createWebhookLog(db, subscriptionId, {
 *     event: 'payment.completed',
 *     success: true,
 *     statusCode: 200
 *   })
 */
export async function createWebhookLog(
  db: PrismaFixtureClient,
  subscriptionId: string,
  overrides: Partial<{
    event: string
    payload: Record<string, unknown>
    statusCode: number | null
    attempts: number
    success: boolean
    error: string | null
  }> = {},
) {
  return db.webhookLog.create({
    data: {
      subscriptionId,
      event: 'payment.created',
      payload: {
        id: faker.string.uuid(),
        amount: 100,
        timestamp: new Date().toISOString(),
      },
      statusCode: null,
      attempts: 0,
      success: false,
      error: null,
      ...overrides,
    },
  })
}

/**
 * Create a Booking fixture with optional overrides.
 *
 * @param db - Prisma client instance
 * @param overrides - Partial Booking data to override defaults
 * @returns Created Booking record
 *
 * Example:
 *   const booking = await createBooking(db, {
 *     workerId,
 *     requesterId,
 *     startTime: new Date('2026-09-01T10:00:00Z'),
 *     endTime: new Date('2026-09-01T12:00:00Z'),
 *     serviceDescription: 'House cleaning'
 *   })
 */
export async function createBooking(
  db: PrismaFixtureClient,
  overrides: Partial<{
    workerId: string
    requesterId: string
    startTime: Date
    endTime: Date
    timezone: string
    serviceDescription: string
    note: string
  }> = {},
) {
  // Create worker and requester if not provided
  let workerId = overrides.workerId
  if (!workerId) {
    const worker = await db.worker.create({
      data: {
        name: faker.person.fullName(),
        categoryId: await getOrCreateCategoryId(db),
        curatorId: await getOrCreateUserId(db),
      },
    })
    workerId = worker.id
  }

  let requesterId = overrides.requesterId
  if (!requesterId) {
    const requester = await db.user.create({
      data: {
        email: faker.internet.email(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        password: 'hashed_password_placeholder',
      },
    })
    requesterId = requester.id
  }

  const now = new Date()
  const startTime = overrides.startTime ?? new Date(now.getTime() + 24 * 60 * 60 * 1000) // Tomorrow
  const endTime =
    overrides.endTime ?? new Date(startTime.getTime() + 2 * 60 * 60 * 1000) // 2 hours later

  return db.booking.create({
    data: {
      startTime,
      endTime,
      timezone: 'UTC',
      serviceDescription: faker.lorem.sentence(),
      note: faker.lorem.sentence(),
      ...overrides,
      workerId, // Ensure workerId is set from the variable
      requesterId, // Ensure requesterId is set from the variable
    },
  })
}

/**
 * Create an EscrowRecord fixture with optional overrides.
 *
 * @param db - Prisma client instance
 * @param overrides - Partial EscrowRecord data to override defaults
 * @returns Created EscrowRecord record
 *
 * Example:
 *   const escrow = await createEscrowRecord(db, {
 *     payerId,
 *     payeeId,
 *     amountXlm: 50,
 *     status: 'pending'
 *   })
 */
export async function createEscrowRecord(
  db: PrismaFixtureClient,
  overrides: Partial<{
    jobId: string | null
    payerId: string
    payeeId: string
    amountXlm: number
    status: 'pending' | 'released' | 'cancelled'
    txId: string | null
    expiresAt: Date
    releasedAt: Date | null
    cancelledAt: Date | null
  }> = {},
) {
  // Create payer and payee if not provided
  let payerId = overrides.payerId
  if (!payerId) {
    const payer = await db.user.create({
      data: {
        email: faker.internet.email(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        password: 'hashed_password_placeholder',
      },
    })
    payerId = payer.id
  }

  let payeeId = overrides.payeeId
  if (!payeeId) {
    const payee = await db.user.create({
      data: {
        email: faker.internet.email(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        password: 'hashed_password_placeholder',
      },
    })
    payeeId = payee.id
  }

  const now = new Date()
  const expiresAt = overrides.expiresAt ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

  return db.escrowRecord.create({
    data: {
      amountXlm: 50, // Default 50 XLM
      status: 'pending',
      expiresAt,
      txId: null,
      releasedAt: null,
      cancelledAt: null,
      ...overrides,
      payerId, // Ensure payerId is set from the variable
      payeeId, // Ensure payeeId is set from the variable
    },
  })
}

/**
 * Batch create multiple StellarAccount fixtures.
 *
 * @param db - Prisma client instance
 * @param count - Number of accounts to create
 * @param baseOverrides - Common overrides for all created accounts
 * @returns Array of created StellarAccount records
 *
 * Example:
 *   const accounts = await createStellarAccounts(db, 5)
 */
export async function createStellarAccounts(
  db: PrismaFixtureClient,
  count: number,
  baseOverrides: Partial<{
    userId: string
    publicKey: string
    balance: number
    sequences: bigint | number
  }> = {},
) {
  const accounts = []
  for (let i = 0; i < count; i++) {
    const account = await createStellarAccount(db, baseOverrides)
    accounts.push(account)
  }
  return accounts
}

/**
 * Batch create multiple WebhookSubscription fixtures.
 *
 * @param db - Prisma client instance
 * @param userId - User ID for all subscriptions
 * @param count - Number of subscriptions to create
 * @param baseOverrides - Common overrides for all created subscriptions
 * @returns Array of created WebhookSubscription records
 *
 * Example:
 *   const subscriptions = await createWebhookSubscriptions(db, userId, 3)
 */
export async function createWebhookSubscriptions(
  db: PrismaFixtureClient,
  userId: string,
  count: number,
  baseOverrides: Partial<{
    url: string
    secret: string
    events: string[]
    isActive: boolean
  }> = {},
) {
  const subscriptions = []
  for (let i = 0; i < count; i++) {
    const subscription = await createWebhookSubscription(db, {
      userId,
      ...baseOverrides,
    })
    subscriptions.push(subscription)
  }
  return subscriptions
}

/**
 * Batch create multiple Booking fixtures.
 *
 * @param db - Prisma client instance
 * @param count - Number of bookings to create
 * @param baseOverrides - Common overrides for all created bookings
 * @returns Array of created Booking records
 *
 * Example:
 *   const bookings = await createBookings(db, 5, { workerId, requesterId })
 */
export async function createBookings(
  db: PrismaFixtureClient,
  count: number,
  baseOverrides: Partial<{
    workerId: string
    requesterId: string
    startTime: Date
    endTime: Date
    timezone: string
    serviceDescription: string
    note: string
  }> = {},
) {
  const bookings = []
  for (let i = 0; i < count; i++) {
    const booking = await createBooking(db, baseOverrides)
    bookings.push(booking)
  }
  return bookings
}

/**
 * Batch create multiple EscrowRecord fixtures.
 *
 * @param db - Prisma client instance
 * @param count - Number of escrow records to create
 * @param baseOverrides - Common overrides for all created escrow records
 * @returns Array of created EscrowRecord records
 *
 * Example:
 *   const escrows = await createEscrowRecords(db, 5, { amountXlm: 100 })
 */
export async function createEscrowRecords(
  db: PrismaFixtureClient,
  count: number,
  baseOverrides: Partial<{
    jobId: string | null
    payerId: string
    payeeId: string
    amountXlm: number
    status: 'pending' | 'released' | 'cancelled'
    txId: string | null
    expiresAt: Date
    releasedAt: Date | null
    cancelledAt: Date | null
  }> = {},
) {
  const escrows = []
  for (let i = 0; i < count; i++) {
    const escrow = await createEscrowRecord(db, baseOverrides)
    escrows.push(escrow)
  }
  return escrows
}

/**
 * Helper function to get or create a User.
 * Used internally by other factories when user creation is needed.
 *
 * @param db - Prisma client instance
 * @returns User ID
 */
async function getOrCreateUserId(db: PrismaFixtureClient): Promise<string> {
  const user = await db.user.create({
    data: {
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      password: 'hashed_password_placeholder',
    },
  })
  return user.id
}

/**
 * Helper function to get or create a Category.
 * Used internally by the Booking factory.
 *
 * @param db - Prisma client instance
 * @returns Category ID
 */
async function getOrCreateCategoryId(db: PrismaFixtureClient): Promise<string> {
  const existing = await db.category.findFirst()
  if (existing) return existing.id

  const category = await db.category.create({
    data: {
      name: faker.commerce.department(),
      description: faker.lorem.sentence(),
    },
  })
  return category.id
}
