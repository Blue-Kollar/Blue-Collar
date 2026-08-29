/**
 * Seed script — #834
 *
 * Populates the local / CI database with a demo-ready dataset:
 *   - 10 categories
 *   - 1 admin user
 *   - 3 curator users
 *   - 20 workers (2 per curator, spread across categories)
 *   - Optional sample reviews (--reviews flag)
 *
 * Safety rules:
 *   - Idempotent: re-running is safe (upsert / skipDuplicates everywhere).
 *   - Production guard: plain-text dev passwords are only allowed in
 *     NODE_ENV !== 'production'. In production, passwords MUST come from
 *     environment variables.
 *
 * Usage:
 *   pnpm seed                  # basic seed
 *   pnpm seed -- --reviews     # also seed sample reviews
 *   pnpm seed:reset            # wipe + re-seed (dev only)
 */

import { hash } from 'argon2'
import { db } from '../db.js'

// ── Guards ────────────────────────────────────────────────────────────────────

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

if (IS_PRODUCTION) {
  const required = [
    'SEED_ADMIN_PASSWORD',
    'SEED_CURATOR1_PASSWORD',
    'SEED_CURATOR2_PASSWORD',
    'SEED_CURATOR3_PASSWORD',
  ]
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`${key} is required when seeding in production`)
    }
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Plumber',            description: 'Pipe fitting, repairs, and water system installations',    icon: '🔧' },
  { name: 'Electrician',        description: 'Wiring, electrical installations, and repairs',            icon: '⚡' },
  { name: 'Carpenter',          description: 'Woodwork, furniture making, and framing',                  icon: '🪚' },
  { name: 'Welder',             description: 'Metal fabrication, welding, and structural work',          icon: '🔩' },
  { name: 'Mason',              description: 'Brickwork, concrete, and stonework',                       icon: '🧱' },
  { name: 'Painter',            description: 'Interior and exterior painting and finishing',              icon: '🎨' },
  { name: 'Roofer',             description: 'Roof installation, repair, and waterproofing',             icon: '🏠' },
  { name: 'HVAC Technician',    description: 'Heating, ventilation, and air conditioning systems',       icon: '❄️' },
  { name: 'Landscaper',         description: 'Garden design, lawn care, and outdoor maintenance',        icon: '🌿' },
  { name: 'General Contractor', description: 'Full-service construction and project management',          icon: '🏗️' },
]

// ── Demo users ────────────────────────────────────────────────────────────────

const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    ?? 'admin@bluecollar.dev'
const ADMIN_PW       = process.env.SEED_ADMIN_PASSWORD ?? (IS_PRODUCTION ? '' : 'Admin1234!')

const CURATOR_USERS = [
  {
    email:     process.env.SEED_CURATOR1_EMAIL ?? 'curator1@bluecollar.dev',
    password:  process.env.SEED_CURATOR1_PASSWORD ?? (IS_PRODUCTION ? '' : 'Curator1234!'),
    firstName: 'Alice',
    lastName:  'Curator',
  },
  {
    email:     process.env.SEED_CURATOR2_EMAIL ?? 'curator2@bluecollar.dev',
    password:  process.env.SEED_CURATOR2_PASSWORD ?? (IS_PRODUCTION ? '' : 'Curator1234!'),
    firstName: 'Bob',
    lastName:  'Curator',
  },
  {
    email:     process.env.SEED_CURATOR3_EMAIL ?? 'curator3@bluecollar.dev',
    password:  process.env.SEED_CURATOR3_PASSWORD ?? (IS_PRODUCTION ? '' : 'Curator1234!'),
    firstName: 'Carol',
    lastName:  'Curator',
  },
]

// ── Worker fixture data ───────────────────────────────────────────────────────

/** Returns 7 realistic workers per category name (only 10 are used below). */
function workerFixtures(categoryName: string, curatorId: string): Array<{
  name: string; bio: string; phone: string; email: string; isActive: boolean; isVerified: boolean; curatorId: string; createdById: string; updatedById: string;
}> {
  const templates: Record<string, Array<{ name: string; bio: string }>> = {
    'Plumber':            [
      { name: 'Marcus Silva',    bio: '15 years fixing leaks and installing pipe systems across the city.' },
      { name: 'Toni Weaver',     bio: 'Specialises in emergency call-outs and boiler replacements.' },
    ],
    'Electrician':        [
      { name: 'Sandra Okafor',   bio: 'Licensed electrician with expertise in smart-home systems.' },
      { name: 'James Ferreira',  bio: 'Commercial and residential wiring, 10 years experience.' },
    ],
    'Carpenter':          [
      { name: 'Luca Moretti',    bio: 'Custom furniture and kitchen installations at competitive rates.' },
      { name: 'Ana Papadopoulos',bio: 'Fine joinery and fitted wardrobes, fully insured.' },
    ],
    'Welder':             [
      { name: 'David Kim',       bio: 'MIG, TIG, and stick welding for structural and decorative work.' },
      { name: 'Fatima Alves',    bio: 'Mobile welding rig — comes to your site.' },
    ],
    'Mason':              [
      { name: 'Robert Mensah',   bio: 'Brickwork, render, and damp-proofing specialist.' },
      { name: 'Elena Vasquez',   bio: 'Stonework restoration and modern concrete finishes.' },
    ],
    'Painter':            [
      { name: 'Oliver Brown',    bio: 'Interior and exterior, spray and brush, residential and commercial.' },
      { name: 'Priya Nair',      bio: 'Decorative finishes, Venetian plaster, and colour consultation.' },
    ],
    'Roofer':             [
      { name: 'Kyle Thomas',     bio: 'Flat and pitched roofs, EPDM, and GRP fibreglass.' },
      { name: 'Mei-Lin Chen',    bio: 'Heritage and conservation roofing, lead-work specialist.' },
    ],
    'HVAC Technician':    [
      { name: 'Daniel Osei',     bio: 'F-Gas certified, heat-pump installs, and AC servicing.' },
      { name: 'Sofia Martins',   bio: 'Ventilation design and commercial refrigeration.' },
    ],
    'Landscaper':         [
      { name: 'Jack O\'Brien',   bio: 'Garden design, decking, and seasonal maintenance.' },
      { name: 'Amara Diallo',    bio: 'Vertical gardens and sustainable planting schemes.' },
    ],
    'General Contractor': [
      { name: 'Hassan Ahmed',    bio: 'End-to-end project management for residential refurbs.' },
      { name: 'Nadia Costa',     bio: 'Commercial fit-outs and fast-track construction.' },
    ],
  }

  const list = templates[categoryName] ?? [
    { name: 'Demo Worker',  bio: 'Sample worker for local development.' },
    { name: 'Demo Worker 2', bio: 'Another sample worker.' },
  ]

  return list.map((t, i) => ({
    ...t,
    phone:      `+1555000${String(i).padStart(4, '0')}`,
    email:      `${t.name.toLowerCase().replace(/[^a-z]/g, '')}@workers.bluecollar.dev`,
    isActive:   true,
    isVerified: i === 0, // first worker per category is verified
    curatorId,
    createdById: curatorId,
    updatedById: curatorId,
  }))
}

// ── Sample reviews ────────────────────────────────────────────────────────────

const REVIEW_BODIES = [
  'Excellent work, arrived on time and left the place spotless.',
  'Very professional. Would definitely recommend.',
  'Completed the job quickly and at a fair price.',
  'Good quality work, communication could be a bit better.',
  'Fixed the problem first time — very impressed.',
]

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding database...')

  // 1. Categories
  await db.category.createMany({ data: CATEGORIES, skipDuplicates: true })
  console.log(`   ✅ ${CATEGORIES.length} categories upserted`)

  // 2. Admin user
  const adminHash = await hash(ADMIN_PW)
  const admin = await db.user.upsert({
    where:  { email: ADMIN_EMAIL },
    update: {},
    create: {
      email:     ADMIN_EMAIL,
      password:  adminHash,
      firstName: 'Admin',
      lastName:  'User',
      role:      'admin',
      verified:  true,
    },
  })
  console.log(`   ✅ Admin: ${ADMIN_EMAIL}`)

  // 3. Curators
  const curatorRecords = await Promise.all(
    CURATOR_USERS.map(async (c) => {
      const pw = await hash(c.password)
      return db.user.upsert({
        where:  { email: c.email },
        update: {},
        create: {
          email:     c.email,
          password:  pw,
          firstName: c.firstName,
          lastName:  c.lastName,
          role:      'curator',
          verified:  true,
        },
      })
    }),
  )
  console.log(`   ✅ ${curatorRecords.length} curators upserted`)

  // 4. Fetch category IDs
  const categories = await db.category.findMany({ select: { id: true, name: true } })
  const categoryMap = new Map(categories.map(c => [c.name, c.id]))

  // 5. Workers — 2 per category (assign curators round-robin)
  let workerCount = 0
  for (const cat of CATEGORIES) {
    const categoryId = categoryMap.get(cat.name)
    if (!categoryId) continue

    const curatorIndex = workerCount % curatorRecords.length
    const curator = curatorRecords[curatorIndex]
    const fixtures = workerFixtures(cat.name, curator.id)

    for (const fixture of fixtures) {
      const existing = await db.worker.findFirst({
        where: { email: fixture.email },
        select: { id: true },
      })
      if (!existing) {
        await db.worker.create({ data: { ...fixture, categoryId } })
        workerCount++
      }
    }
  }
  console.log(`   ✅ ${workerCount} workers created (idempotent — skipped existing)`)

  return { admin, curators: curatorRecords }
}

// ── Optional: sample reviews ─────────────────────────────────────────────────

async function seedReviews(adminId: string) {
  console.log('   🌱 Seeding sample reviews...')

  const workers = await db.worker.findMany({
    where: { deletedAt: null },
    take: 10,
    select: { id: true },
  })

  let count = 0
  for (const worker of workers) {
    for (let i = 0; i < 3; i++) {
      const existing = await db.review.findFirst({
        where: { workerId: worker.id, authorId: adminId },
      })
      if (existing) continue

      await db.review.create({
        data: {
          workerId: worker.id,
          userId:   adminId,
          authorId: adminId,
          rating:   Math.floor(Math.random() * 2) + 4, // 4 or 5 stars
          body:     REVIEW_BODIES[count % REVIEW_BODIES.length],
          status:   'approved',
        },
      })
      count++
    }
  }
  console.log(`   ✅ ${count} sample reviews created`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

const withReviews = process.argv.includes('--reviews')
const reset      = process.argv.includes('--reset')

async function main() {
  if (reset) {
    if (IS_PRODUCTION) {
      throw new Error('--reset is not allowed in production')
    }
    console.log('🗑️  Wiping data (--reset)...')
    // Order matters: respect FK constraints
    await db.$transaction([
      db.review.deleteMany(),
      db.worker.deleteMany(),
      db.user.deleteMany(),
      db.category.deleteMany(),
    ])
    console.log('   Done.')
  }

  const { admin } = await seed()

  if (withReviews) {
    await seedReviews(admin.id)
  }

  console.log('\n🎉 Seed complete!')
  console.log(`   Admin:    ${process.env.SEED_ADMIN_EMAIL ?? 'admin@bluecollar.dev'} / (see SEED_ADMIN_PASSWORD)`)
  console.log(`   Curator:  curator1@bluecollar.dev … curator3@bluecollar.dev`)
  console.log(`   Workers:  20 workers across 10 categories`)
  if (withReviews) console.log('   Reviews:  up to 30 sample reviews')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
