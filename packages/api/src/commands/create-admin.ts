import { parseArgs } from 'node:util'
import argon2 from 'argon2'
import { db } from '../db.js'

const { values } = parseArgs({
  options: {
    email:     { type: 'string' },
    password:  { type: 'string' },
    firstName: { type: 'string' },
    lastName:  { type: 'string' },
  },
})

const { email, password, firstName, lastName } = values

if (!email || !password || !firstName || !lastName) {
  console.error('Usage: pnpm admin:create --email <email> --password <password> --firstName <firstName> --lastName <lastName>')
  process.exit(1)
}

const hashed = await argon2.hash(password)

const user = await db.user.create({
  data: { email, password: hashed, firstName, lastName, role: 'admin', verified: true },
  select: { id: true, email: true, role: true },
})

console.log('Admin created:', user)
await db.$disconnect()
