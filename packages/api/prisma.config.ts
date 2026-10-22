import 'dotenv/config'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: path.join(import.meta.dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
    // Used by `prisma migrate dev` and by `migrate diff --from-migrations`,
    // which replays the migration history into a throwaway database.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
})