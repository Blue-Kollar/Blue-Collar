import type { Request, Response } from 'express'
import argon2 from 'argon2'
import { db } from '../db.js'
import { sanitizeUser } from '../models/user.model.js'

// ── Profile update ────────────────────────────────────────────────────────────

export async function updateProfile(req: Request, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized', code: 401 })

  const { firstName, lastName, phone, bio } = req.body as {
    firstName?: string
    lastName?: string
    phone?: string
    bio?: string
  }

  try {
    const user = await db.user.update({
      where: { id: userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(bio !== undefined && { bio }),
      },
    })
    return res.json({ data: sanitizeUser(user), status: 'success', code: 200 })
  } catch (error) {
    console.error('[updateProfile] error:', error)
    return res.status(500).json({ status: 'error', message: 'Failed to update profile', code: 500 })
  }
}

// ── Change password ───────────────────────────────────────────────────────────

export async function changePassword(req: Request, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized', code: 401 })

  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string
    newPassword?: string
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ status: 'error', message: 'currentPassword and newPassword are required', code: 400 })
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ status: 'error', message: 'New password must be at least 8 characters', code: 400 })
  }

  try {
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user || !user.password) {
      return res.status(400).json({ status: 'error', message: 'Cannot change password for OAuth accounts', code: 400 })
    }

    const valid = await argon2.verify(user.password, currentPassword)
    if (!valid) {
      return res.status(400).json({ status: 'error', message: 'Current password is incorrect', code: 400 })
    }

    const hashed = await argon2.hash(newPassword)
    await db.user.update({ where: { id: userId }, data: { password: hashed } })
    return res.json({ status: 'success', message: 'Password updated', code: 200 })
  } catch (error) {
    console.error('[changePassword] error:', error)
    return res.status(500).json({ status: 'error', message: 'Failed to change password', code: 500 })
  }
}

// ── Delete account ────────────────────────────────────────────────────────────

export async function deleteAccount(req: Request, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized', code: 401 })

  try {
    await db.user.delete({ where: { id: userId } })
    return res.json({ status: 'success', message: 'Account deleted', code: 200 })
  } catch (error) {
    console.error('[deleteAccount] error:', error)
    return res.status(500).json({ status: 'error', message: 'Failed to delete account', code: 500 })
  }
}

// ── Push subscriptions ────────────────────────────────────────────────────────

export async function savePushSubscription(req: Request, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized', code: 401 })

  const { endpoint, keys } = req.body
  if (!endpoint || !keys?.auth || !keys?.p256dh) {
    return res.status(400).json({ status: 'error', message: 'Invalid subscription', code: 400 })
  }

  try {
    const subscription = await db.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint } },
      update: { auth: keys.auth, p256dh: keys.p256dh },
      create: { userId, endpoint, auth: keys.auth, p256dh: keys.p256dh },
    })

    return res.json({ data: subscription, status: 'success', code: 201 })
  } catch (error) {
    console.error('[savePushSubscription] error:', error)
    return res.status(500).json({ status: 'error', message: 'Failed to save subscription', code: 500 })
  }
}

export async function deletePushSubscription(req: Request, res: Response) {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized', code: 401 })

  const { endpoint } = req.body
  if (!endpoint) {
    return res.status(400).json({ status: 'error', message: 'Endpoint required', code: 400 })
  }

  try {
    await db.pushSubscription.delete({
      where: { userId_endpoint: { userId, endpoint } },
    })

    return res.json({ status: 'success', message: 'Unsubscribed', code: 200 })
  } catch (error) {
    console.error('[deletePushSubscription] error:', error)
    return res.status(500).json({ status: 'error', message: 'Failed to unsubscribe', code: 500 })
  }
}
