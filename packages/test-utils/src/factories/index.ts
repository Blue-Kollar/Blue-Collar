/**
 * Shared data factories for BlueCollar test suites.
 *
 * These replace duplicated ad-hoc object literals scattered across
 * packages/api, packages/app, and packages/mobile.
 *
 * Usage:
 *   import { userFactory, workerFactory } from '@bluecollar/test-utils/factories'
 */

// NOTE: @faker-js/faker must be installed in the consuming package's
// devDependencies. The factories will work at runtime because faker is
// required lazily — they do NOT add a hard peer-dependency on @faker-js/faker
// so that packages without faker in scope can still import the non-faker
// helpers (makeRequest, makeResponse, etc.).

let _faker: typeof import('@faker-js/faker').faker | null = null

function faker() {
  if (!_faker) {
    // Dynamic require so this module can be imported in environments where
    // faker isn't installed (e.g. a package that only uses makeRequest()).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _faker = require('@faker-js/faker').faker
  }
  return _faker!
}

// ── Type helpers ──────────────────────────────────────────────────────────────

export interface FakeUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'user' | 'curator' | 'admin'
  verified: boolean
  avatar: string | null
  walletAddress: string | null
  createdAt: Date
  updatedAt: Date
}

export interface FakeWorker {
  id: string
  name: string
  bio: string | null
  avatar: string | null
  isVerified: boolean
  walletAddress: string | null
  categoryId: string
  curatorId: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface FakeCategory {
  id: string
  name: string
  slug: string
  icon: string | null
  description: string | null
  createdAt: Date
  updatedAt: Date
}

export interface FakeReview {
  id: string
  rating: number
  comment: string | null
  workerId: string
  authorId: string
  createdAt: Date
  updatedAt: Date
}

export interface FakeAuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'user' | 'curator' | 'admin'
}

// ── Factories ─────────────────────────────────────────────────────────────────

/**
 * Build a fake database User record.
 *
 * @example
 * const admin = userFactory({ role: 'admin', verified: true })
 */
export function userFactory(overrides: Partial<FakeUser> = {}): FakeUser {
  const f = faker()
  const firstName = f.person.firstName()
  const lastName = f.person.lastName()
  return {
    id: f.string.uuid(),
    email: f.internet.email({ firstName, lastName }).toLowerCase(),
    firstName,
    lastName,
    role: 'user',
    verified: true,
    avatar: null,
    walletAddress: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Build a fake authenticated-user shape (subset used by JWT / AuthContext).
 *
 * @example
 * const curator = authUserFactory({ role: 'curator' })
 */
export function authUserFactory(overrides: Partial<FakeAuthUser> = {}): FakeAuthUser {
  const f = faker()
  const firstName = f.person.firstName()
  const lastName = f.person.lastName()
  return {
    id: f.string.uuid(),
    email: f.internet.email({ firstName, lastName }).toLowerCase(),
    firstName,
    lastName,
    role: 'user',
    ...overrides,
  }
}

/**
 * Build a fake Category record.
 */
export function categoryFactory(overrides: Partial<FakeCategory> = {}): FakeCategory {
  const f = faker()
  const name = f.helpers.arrayElement(['Plumber', 'Electrician', 'Carpenter', 'Painter', 'Welder'])
  return {
    id: f.string.uuid(),
    name,
    slug: name.toLowerCase(),
    icon: null,
    description: f.lorem.sentence(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Build a fake Worker record (DB shape, not the API response shape).
 */
export function workerFactory(overrides: Partial<FakeWorker> = {}): FakeWorker {
  const f = faker()
  return {
    id: f.string.uuid(),
    name: f.person.fullName(),
    bio: f.lorem.paragraph(),
    avatar: null,
    isVerified: false,
    walletAddress: `G${f.string.alphanumeric(55).toUpperCase()}`,
    categoryId: f.string.uuid(),
    curatorId: f.string.uuid(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Build a fake Review record.
 */
export function reviewFactory(overrides: Partial<FakeReview> = {}): FakeReview {
  const f = faker()
  return {
    id: f.string.uuid(),
    rating: f.number.int({ min: 1, max: 5 }),
    comment: f.lorem.sentence(),
    workerId: f.string.uuid(),
    authorId: f.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Generate a valid-looking Stellar wallet address (G + 55 alphanumeric chars).
 * Not cryptographically valid, but passes format checks in tests.
 */
export function stellarAddressFactory(): string {
  const f = faker()
  return `G${f.string.alphanumeric(55).toUpperCase()}`
}
