import { afterAll } from 'vitest'
import { db } from './src/db.js'

afterAll(async () => {
  await db.$disconnect()
})
