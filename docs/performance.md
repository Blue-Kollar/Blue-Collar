# Performance Best Practices

A practical guide to keeping BlueCollar fast across every layer — database, API, frontend, and infrastructure.

---

## Database Query Optimization

BlueCollar uses **PostgreSQL** via **Prisma ORM**. The patterns below apply to both raw queries and Prisma client calls.

### Select only what you need

Avoid `SELECT *`. Use Prisma's `select` or `include` to fetch only the fields required by the response.

```ts
// bad — fetches all columns including password, tokens, etc.
const user = await prisma.user.findUnique({ where: { id } });

// good
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, firstName: true, lastName: true, avatar: true },
});
```

### Paginate all list queries

Never return unbounded lists. Use cursor-based pagination for large tables (workers, reviews).

```ts
const workers = await prisma.worker.findMany({
  take: 20,
  skip: (page - 1) * 20,
  where: { isActive: true },
  orderBy: { createdAt: "desc" },
});
```

### Index high-cardinality filter columns

Columns used in `WHERE`, `ORDER BY`, or `JOIN` conditions should be indexed. Key indexes for this schema:

```sql
-- Already unique (auto-indexed): User.email, User.googleId, User.resetToken
-- Add these if not present:
CREATE INDEX idx_worker_category ON "Worker"("categoryId");
CREATE INDEX idx_worker_location ON "Worker"("locationId");
CREATE INDEX idx_worker_active   ON "Worker"("isActive");
CREATE INDEX idx_review_worker   ON "Review"("workerId");
CREATE INDEX idx_bookmark_user   ON "Bookmark"("userId");
```

Add indexes via Prisma schema using `@@index`:

```prisma
model Worker {
  // ...
  @@index([categoryId])
  @@index([locationId])
  @@index([isActive])
}
```

### Avoid N+1 queries

Use `include` or `select` with nested relations instead of looping and querying inside a loop.

```ts
// bad — N+1
const workers = await prisma.worker.findMany();
for (const w of workers) {
  w.category = await prisma.category.findUnique({ where: { id: w.categoryId } });
}

// good — single query with JOIN
const workers = await prisma.worker.findMany({
  include: { category: true, location: true },
});
```

### Use transactions for multi-step writes

Wrap related writes in `prisma.$transaction` to ensure atomicity and reduce round-trips.

```ts
await prisma.$transaction([
  prisma.worker.update({ where: { id }, data: { isVerified: true } }),
  prisma.user.update({ where: { id: curatorId }, data: { updatedAt: new Date() } }),
]);
```

### Connection pooling

Configure `DATABASE_URL` with PgBouncer or use Prisma Accelerate in production to avoid exhausting PostgreSQL connections under load.

```
DATABASE_URL="postgresql://user:pass@pgbouncer-host:6432/bluecollar?pgbouncer=true"
```

---

## API Caching Strategies

### HTTP response caching

Set `Cache-Control` headers on read-heavy, infrequently-changing endpoints.

```ts
// categories list — changes rarely
res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=60");

// worker profile — changes occasionally
res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=30");

// authenticated user data — never cache publicly
res.set("Cache-Control", "private, no-store");
```

### In-memory caching (Node.js)

For data that is expensive to compute and shared across requests (e.g. category list), use a simple TTL cache.

```ts
import { LRUCache } from "lru-cache"; // or node-cache

const cache = new LRUCache<string, unknown>({ max: 500, ttl: 1000 * 60 * 5 });

export async function getCategories() {
  const cached = cache.get("categories");
  if (cached) return cached;
  const data = await prisma.category.findMany();
  cache.set("categories", data);
  return data;
}
```

### Redis (recommended for production)

Use Redis for shared cache across multiple API instances.

```ts
import { createClient } from "redis";
const redis = createClient({ url: process.env.REDIS_URL });

async function getCachedWorker(id: string) {
  const hit = await redis.get(`worker:${id}`);
  if (hit) return JSON.parse(hit);
  const worker = await prisma.worker.findUnique({ where: { id }, include: { category: true } });
  await redis.setEx(`worker:${id}`, 60, JSON.stringify(worker));
  return worker;
}
```

Invalidate on write:

```ts
await redis.del(`worker:${id}`);
```

### Rate limiting

The existing `rateLimiter` middleware protects against abuse. Tune limits per route:

```ts
// stricter for auth endpoints
authRouter.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));

// looser for public read endpoints
workersRouter.use(rateLimit({ windowMs: 60 * 1000, max: 200 }));
```

---

## Frontend Bundle Optimization

BlueCollar's frontend is a **Next.js 14** app with the App Router.

### Code splitting

Next.js automatically splits by route. For large client-side components, use dynamic imports to defer loading.

```tsx
import dynamic from "next/dynamic";

const TipModal = dynamic(() => import("@/components/TipModal"), { ssr: false });
const QRCodeModal = dynamic(() => import("@/components/QRCodeModal"), { ssr: false });
```

### Analyze bundle size

```bash
# in packages/app
ANALYZE=true npm run build
```

Install `@next/bundle-analyzer` and configure in `next.config.mjs`:

```js
import bundleAnalyzer from "@next/bundle-analyzer";
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });
export default withBundleAnalyzer({ /* your config */ });
```

### Tree-shake heavy libraries

Import only what you use from large packages.

```ts
// bad
import * as StellarSdk from "@stellar/stellar-sdk";

// good
import { TransactionBuilder, Networks } from "@stellar/stellar-sdk";
```

### Font optimization

The app already uses `geist` via `next/font`. Ensure fonts are loaded with `display: swap` and subsets are restricted.

```ts
import { GeistSans } from "geist/font/sans";
// GeistSans already handles subsetting — avoid importing unused weights
```

### Image optimization

See the [Image Optimization](#image-optimization) section below.

### Minimize client components

Prefer React Server Components (RSC) for data-fetching pages. Only add `"use client"` where interactivity is required (forms, modals, wallet interactions).

```tsx
// page.tsx — server component, no bundle cost
export default async function WorkersPage() {
  const workers = await fetchWorkers(); // server-side fetch
  return <WorkerList workers={workers} />;
}
```

### Tailwind CSS purging

Tailwind v4 (used here) purges unused styles by default in production builds. Ensure `content` paths in `tailwind.config.ts` cover all component files.

---

## Image Optimization

### API-side processing

The API uses `sharp` for image processing. Apply these settings when handling uploads:

```ts
import sharp from "sharp";

await sharp(inputBuffer)
  .resize(800, 800, { fit: "inside", withoutEnlargement: true })
  .webp({ quality: 80 })
  .toFile(outputPath);
```

For avatars (smaller, square):

```ts
await sharp(inputBuffer)
  .resize(256, 256, { fit: "cover" })
  .webp({ quality: 75 })
  .toFile(avatarPath);
```

### Next.js `<Image>` component

Always use `next/image` instead of `<img>` for automatic format conversion, lazy loading, and responsive sizing.

```tsx
import Image from "next/image";

<Image
  src={worker.avatar}
  alt={worker.name}
  width={256}
  height={256}
  sizes="(max-width: 768px) 100vw, 256px"
  priority={false} // set true only for above-the-fold images
/>
```

### Configure remote image domains

In `next.config.mjs`, restrict allowed image origins:

```js
images: {
  remotePatterns: [
    { protocol: "https", hostname: "your-cdn.com" },
    { protocol: "http", hostname: "localhost" },
  ],
},
```

### Serve from a CDN

In production, serve uploaded images from a CDN (e.g. CloudFront, Cloudflare R2) rather than directly from the API server. Update `NEXT_PUBLIC_API_URL` to point to the CDN origin.

---

## Monitoring and Profiling

### API logging

The API uses **Pino** for structured JSON logging. In production, pipe logs to a log aggregator (Datadog, Loki, CloudWatch).

```ts
// already configured in src/config/logger.ts
// ensure LOG_LEVEL=info in production, LOG_LEVEL=debug in development
```

Key metrics to log:
- Request duration (already provided by `pino-http`)
- Database query duration (use Prisma's `$on("query", ...)` event)
- External service call latency (Stellar, mailer)

```ts
prisma.$on("query", (e) => {
  if (e.duration > 100) {
    logger.warn({ query: e.query, duration: e.duration }, "Slow query detected");
  }
});
```

### Frontend performance

Use the built-in Next.js Speed Insights or Web Vitals reporting:

```tsx
// app/layout.tsx
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

Track Core Web Vitals targets:
- LCP (Largest Contentful Paint) < 2.5s
- FID / INP < 100ms
- CLS < 0.1

### Database query profiling

Use `EXPLAIN ANALYZE` in PostgreSQL to profile slow queries:

```sql
EXPLAIN ANALYZE
SELECT w.*, c.name as category_name
FROM "Worker" w
JOIN "Category" c ON w."categoryId" = c.id
WHERE w."isActive" = true
ORDER BY w."createdAt" DESC
LIMIT 20;
```

Enable `pg_stat_statements` extension for aggregate query stats:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

### Docker resource limits

Set memory and CPU limits in `docker-compose.yml` to catch resource leaks early:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
```

### Recommended tools

| Layer    | Tool                          | Purpose                        |
| -------- | ----------------------------- | ------------------------------ |
| API      | Pino + pino-http              | Structured request logging     |
| API      | Prisma query events           | Slow query detection           |
| Database | pg_stat_statements            | Aggregate query profiling      |
| Database | pgAdmin / psql EXPLAIN        | Per-query execution plans      |
| Frontend | Next.js Speed Insights        | Core Web Vitals tracking       |
| Frontend | @next/bundle-analyzer         | Bundle size analysis           |
| Frontend | Chrome DevTools Lighthouse    | Full page performance audit    |
| Infra    | Docker stats / cAdvisor       | Container resource monitoring  |
