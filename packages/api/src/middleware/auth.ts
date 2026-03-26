import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ status: 'error', message: 'Unauthorized', code: 401 })
  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string }
    next()
  } catch {
    return res.status(401).json({ status: 'error', message: 'Invalid token', code: 401 })
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Forbidden', code: 403 })
    }
    next()
  }
}
