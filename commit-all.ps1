$env:PATH += ";C:\Program Files\Git\bin"
Set-Location "C:\Users\USER\Documents\Blue-Collar"

# Force-add all new/modified files for all 4 issues
git rm --cached packages/api/src/middleware/cache.ts 2>$null
git rm --cached packages/api/src/services/cache.service.ts 2>$null
git rm --cached packages/api/src/middleware/rateLimit.ts 2>$null
git rm --cached packages/api/src/config/rateLimits.ts 2>$null
git rm --cached packages/api/src/queue/index.ts 2>$null
git rm --cached packages/api/src/workers/email.worker.ts 2>$null
git rm --cached packages/api/src/workers/notification.worker.ts 2>$null
git rm --cached packages/api/src/workers/scheduler.worker.ts 2>$null
git rm --cached packages/api/src/controllers/bookings.ts 2>$null
git rm --cached packages/api/src/services/booking.service.ts 2>$null
git rm --cached packages/api/src/routes/bookings.ts 2>$null
git rm --cached packages/api/prisma/schema.prisma 2>$null

git add -f packages/api/src/services/cache.service.ts
git add -f packages/api/src/middleware/cache.ts
git add -f packages/api/src/middleware/rateLimit.ts
git add -f packages/api/src/config/rateLimits.ts
git add -f packages/api/src/queue/index.ts
git add -f packages/api/src/workers/email.worker.ts
git add -f packages/api/src/workers/notification.worker.ts
git add -f packages/api/src/workers/scheduler.worker.ts
git add -f packages/api/src/controllers/bookings.ts
git add -f packages/api/src/services/booking.service.ts
git add -f packages/api/src/routes/bookings.ts
git add -f packages/api/prisma/schema.prisma

git status --short
git diff --cached --stat
