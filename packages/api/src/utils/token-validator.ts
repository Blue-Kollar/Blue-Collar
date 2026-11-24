import jwt from 'jsonwebtoken'
import { env } from '@/config/env.js'

export type TokenPayload = { id: string; role: string; jti?: string }

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload
}
