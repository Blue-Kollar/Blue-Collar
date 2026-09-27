/**
 * Staging seed script — #834
 *
 * Creates a realistic staging dataset using @faker-js/faker.
 * Matches the actual Prisma schema (User, Worker, Category, Review, Location).
 *
 * Safety:
 *   - Requires NODE_ENV=staging or ALLOW_STAGING_SEED=true
 *   - Idempotent: upserts users/categories, skips existing workers/reviews
 *
 * Usage:
 *   NODE_ENV=staging pnpm seed:staging
 *   ALLOW_STAGING_SEED=true pnpm seed:staging
 */

import { hash } from 'argon2'
import { faker } from '@faker-js/faker'
import { db } from '../db.js'

// ── Guard ─────────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_STAGING_SEED) {
  throw new Error('Staging seed is not allowed in production. Set ALLOW_STAGING_SEED=true to override.')
}

// ── Passwords ─────────────────────────────────────────────────────────────────

const STAGING_ADMIN_PW   = process.env.STAGING_ADMIN_PASSWORD   ?? 'Staging-Admin-2024!'
const STAGING_CURATOR_PW = process.env.STAGING_CURATOR_PASSWORD ?? 'Staging-Curator-2024!'
const STAGING_USER_PW    = process.env.STAGING_USER_PASSWORD    ?? 'Staging-User-2024!'

// ── Categories ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Plumber',            description: 'Pipe fitting, repairs, water systems',             icon: '🔧' },
  { name: 'Electrician',        description: 'Wiring, electrical installations, repairs',         icon: '⚡' },
  { name: 'Carpenter',          description: 'Woodwork, furniture, framing',                      icon: '🪚' },
  { name: 'Welder',             description: 'Metal fabrication and structural work',              icon: '🔩' },
  { name: 'Mason',              description: 'Brickwork, concrete, stonework',                    icon: '🧱' },
  { name: 'Painter',            description: 'Interior and exterior painting',                    icon: '🎨' },
  { name: 'Roofer',             description: 'Roof installation, repair, waterproofing',          icon: '🏠' },
  { name: 'HVAC Technician',    description: 'Heating, ventilation, air conditioning',            icon: '❄️' },
  { name: 'Landscaper',         description: 'Garden design, lawn care, maintenance',             icon: '🌿' },
  { name: 'General Contractor', description: 'Full-service construction and project management',   icon: '🏗️' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomRole(i: number): 'user' | 'curator' | 'admin' {
  if (i === 0) return 'admin'
  if (i <= 3)  return 'curator'
  return 'user'
}

// ── Main seed ─────────────────────────────────────────────────────────────────

async function seedStaging() {
  console.log('🌱 Seeding staging database...')

  // 1. Categories
  await db.category.createMany({ data: CATEGORIES, skipDuplicates: true })
  const categories = await db.category.findMany({ select: { id: true, name: true } })
  const categoryIds = categories.map(c => c.id)
  console.log(`   ✅ ${categories.length} categories`)

  // 2. Locations
  const locationData = Array.from({ length: 5 }, () => ({
    city:    faker.location.city(),
    state:   faker.location.state({ abbreviated: true }),
    country: 'US',
    lat:     parseFloat(faker.location.latitude().toString()),
    lng:     parseFloat(faker.location.longitude().toString()),
  }))
  const locations = await Promise.all(
    locationData.map(l => db.location.create({ data: l }))
  )
  console.log(`   ✅ ${locations.length} locations`)

  // 3. Users: 1 admin + 3 curators + 10 regular users
  const passwords: Record<string, string> = {
    admin:   await hash(STAGING_ADMIN_PW),
    curator: await hash(STAGING_CURATOR_PW),
    user:    await hash(STAGING_USER_PW),
  }

  const usersToCreate = 14
  const users = await Promise.all(
    Array.from({ length: usersToCreate }, async (_, i) => {
      const role = randomRole(i)
      const email = i === 0
        ? 'admin@staging.bluecollar.example.com'
        : `${role}${i}@staging.bluecollar.example.com`
      return db.user.upsert({
        where:  { email },
        update: {},
        create: {
          email,
          password:  passwords[role],
          firstName: faker.person.firstName(),
          lastName:  faker.person.lastName(),
          role,
          verified:  true,
          locationId: faker.helpers.arrayElement(locations).id,
        },
      })
    })
  )
  const curators = users.filter(u => u.role === 'curator')
  console.log(`   ✅ ${users.length} users (1 admin, ${curators.length} curators, ${users.length - 1 - curators.length} users)`)

  // 4. Workers: ~5 per curator
  let workerCount = 0
  const workers = []
  for (const curator of curators) {
    for (let i = 0; i < 5; i++) {
      const category = faker.helpers.arrayElement(categories)
      const worker = await db.worker.create({
        data: {
          name:        `${faker.person.firstName()} ${faker.person.lastName()}`,
          bio:         faker.lorem.sentences(2),
          phone:       faker.phone.number({ style: 'international' }),
          email:       faker.internet.email().toLowerCase(),
          isActive:    faker.datatype.boolean({ probability: 0.9 }),
          isVerified:  faker.datatype.boolean({ probability: 0.4 }),
          categoryId:  category.id,
          curatorId:   curator.id,
          createdById: curator.id,
          updatedById: curator.id,
          locationId:  faker.helpers.arrayElement(locations).id,
        },
      })
      workers.push(worker)
      workerCount++
    }
  }
  console.log(`   ✅ ${workerCount} workers`)

  // 5. Reviews: 2–4 per worker, authored by regular users
  const regularUsers = users.filter(u => u.role === 'user')
  let reviewCount = 0
  for (const worker of workers) {
    const numReviews = faker.number.int({ min: 0, max: 4 })
    const reviewers = faker.helpers.arrayElements(regularUsers, Math.min(numReviews, regularUsers.length))
    for (const reviewer of reviewers) {
      const existing = await db.review.findFirst({
        where: { workerId: worker.id, authorId: reviewer.id },
      })
      if (existing) continue
      await db.review.create({
        data: {
          workerId: worker.id,
          userId:   reviewer.id,
          authorId: reviewer.id,
          rating:   faker.number.int({ min: 3, max: 5 }),
          body:     faker.lorem.sentences(faker.number.int({ min: 1, max: 3 })),
          status:   'approved',
        },
      })
      reviewCount++
    }
  }
  console.log(`   ✅ ${reviewCount} reviews`)

  console.log('\n🎉 Staging seed complete!')
  console.log('\nTest credentials:')
  console.log(`  Admin:   admin@staging.bluecollar.example.com / ${STAGING_ADMIN_PW}`)
  console.log(`  Curator: curator1@staging.bluecollar.example.com / ${STAGING_CURATOR_PW}`)
  console.log(`  User:    user4@staging.bluecollar.example.com / ${STAGING_USER_PW}`)
}

seedStaging()
  .catch((e) => {
    console.error('❌ Staging seed failed:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
