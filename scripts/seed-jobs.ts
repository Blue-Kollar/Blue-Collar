/**
 * Seed jobs + workers for load testing (#1491).
 *
 * Usage:
 *   SEED_ROWS=100000 npm run seed:jobs
 *
 * Env:
 *   DATABASE_URL  - Postgres connection string (required)
 *   SEED_ROWS     - number of jobs to insert (default 100000)
 *   SEED_BATCH    - insert batch size (default 5000)
 *
 * Idempotent: truncates the load-test tables before inserting.
 */
import { Client } from 'pg';

const ROWS = parseInt(process.env.SEED_ROWS ?? '100000', 10);
const BATCH = parseInt(process.env.SEED_BATCH ?? '5000', 10);
const URL = process.env.DATABASE_URL;

if (!URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const CATEGORIES = ['plumbing', 'electrical', 'carpentry', 'painting', 'cleaning', 'moving', 'gardening', 'roofing'];
const CITIES = ['Lagos', 'Nairobi', 'Accra', 'Kampala', 'Kigali', 'Dar es Salaam', 'Abuja', 'Mombasa'];
const TITLES = ['Repair', 'Installation', 'Maintenance', 'Inspection', 'Emergency', 'Consultation', 'Upgrade', 'Replacement'];

function rnd<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const client = new Client({ connectionString: URL });
  await client.connect();
  console.log('Connected. Seeding', ROWS, 'jobs in batches of', BATCH);

  // Truncate first (idempotent)
  await client.query('TRUNCATE TABLE jobs RESTART IDENTITY CASCADE').catch(() => {});
  console.log('Truncated jobs table (if it existed)');

  const started = Date.now();
  let inserted = 0;

  while (inserted < ROWS) {
    const size = Math.min(BATCH, ROWS - inserted);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let i = 0; i < size; i++) {
      const n = inserted + i;
      const base = values.length;
      const category = rnd(CATEGORIES);
      const city = rnd(CITIES);
      const title = `${rnd(TITLES)} ${category}`;
      const description = `Load-test job ${n}: ${title} in ${city}. Generated for #1491.`;
      const budget = 100 + Math.floor(Math.random() * 9900);
      const createdAt = new Date(Date.now() - Math.floor(Math.random() * 90) * 86400000).toISOString();

      values.push(title, description, category, city, budget, createdAt);
      placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
    }

    await client.query(
      `INSERT INTO jobs (title, description, category, city, budget, created_at)
       VALUES ${placeholders.join(',')}`,
      values,
    );

    inserted += size;
    const pct = ((inserted / ROWS) * 100).toFixed(1);
    process.stdout.write(`\r${inserted}/${ROWS} (${pct}%)`);
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\nDone: ${inserted} jobs seeded in ${elapsed}s`);

  await client.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
