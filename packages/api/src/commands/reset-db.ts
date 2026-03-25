import { execSync } from 'node:child_process'

if (process.env.NODE_ENV === 'production') {
  console.error('db:reset is not allowed in production.')
  process.exit(1)
}

console.log('Resetting database...')
execSync('npx prisma migrate reset --force', { stdio: 'inherit' })
console.log('Database reset complete.')
