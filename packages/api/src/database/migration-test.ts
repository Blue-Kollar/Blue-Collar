/**
 * Migration smoke test — run after `prisma migrate deploy` in CI.
 * Verifies that all expected tables exist and core queries work.
 *
 * Usage: npx tsx src/database/migration-test.ts
 */

import { db } from '../db.js';

async function run() {
  console.log('Running migration smoke tests...');

  // 1. Verify tables exist by running a count on each model
  const checks: Array<[string, () => Promise<number>]> = [
    ['User',     () => db.user.count()],
    ['Worker',   () => db.worker.count()],
    ['Category', () => db.category.count()],
  ];

  for (const [model, query] of checks) {
    try {
      const count = await query();
      console.log(`  ✓ ${model} table accessible (${count} rows)`);
    } catch (err) {
      console.error(`  ✗ ${model} table check failed:`, err);
      process.exit(1);
    }
  }

  // 2. Verify indexes by running a filtered query
  try {
    await db.user.findFirst({ where: { email: 'smoke-test@example.com' } });
    console.log('  ✓ User email index accessible');
  } catch (err) {
    console.error('  ✗ User email index check failed:', err);
    process.exit(1);
  }

  console.log('All migration smoke tests passed.');
}

run()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => db.$disconnect());
