# ── builder ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/package.json

# The api package's `postinstall` runs `prisma generate`, which needs both the
# schema and prisma.config.ts (the datasource URL lives in the config, not the
# schema). Copy them before installing so the hook can find them.
COPY packages/api/prisma ./packages/api/prisma
COPY packages/api/prisma.config.ts ./packages/api/prisma.config.ts

RUN pnpm install --frozen-lockfile --filter @bluecollar/api

COPY packages/api ./packages/api

RUN pnpm --filter @bluecollar/api build

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/package.json
COPY packages/api/prisma ./packages/api/prisma
COPY packages/api/prisma.config.ts ./packages/api/prisma.config.ts

# Not `--prod`: the Prisma CLI is a devDependency, and this image needs it both
# for the `postinstall` client generation and for `prisma migrate deploy` on
# start-up.
RUN pnpm install --frozen-lockfile --filter @bluecollar/api

COPY --from=builder /app/packages/api/dist ./packages/api/dist

WORKDIR /app/packages/api

EXPOSE 3000

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/index.js"]
