import { db } from '../db.js'
import { redis } from '../config/redis.js'
import { formatWorker } from '../models/worker.model.js'

const CACHE_TTL = 60 * 30 // 30 minutes
const INTERACTION_WEIGHTS: Record<string, number> = { view: 1, bookmark: 3, tip: 5, contact: 4 }

/** Track a user interaction with a worker */
export async function trackInteraction(userId: string, workerId: string, type: string) {
  await db.userInteraction.create({ data: { userId, workerId, type: type as any } })
  // Invalidate cached recommendations for this user
  await redis.del(`recommendations:${userId}`).catch(() => {})
}

/**
 * Get recommendations for a user using collaborative filtering + location boost.
 * Algorithm:
 * 1. Score workers the user has interacted with (weighted by type)
 * 2. Find similar users (users who interacted with the same workers)
 * 3. Score workers those similar users interacted with (collaborative filtering)
 * 4. Boost workers in the same location as the user
 * 5. Exclude workers the user already interacted with
 */
export async function getRecommendations(userId: string, limit = 10) {
  const cacheKey = `recommendations:${userId}`

  // Try cache first
  try {
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)
  } catch {}

  // Get user's interactions
  const myInteractions = await db.userInteraction.findMany({
    where: { userId },
    select: { workerId: true, type: true },
  })

  const interactedWorkerIds = new Set(myInteractions.map((i) => i.workerId))

  // Score map: workerId -> score
  const scores = new Map<string, number>()

  if (myInteractions.length > 0) {
    // Find similar users (interacted with same workers)
    const similarUserInteractions = await db.userInteraction.findMany({
      where: {
        workerId: { in: [...interactedWorkerIds] },
        userId: { not: userId },
      },
      select: { userId: true, workerId: true, type: true },
    })

    // Build similarity scores per similar user
    const userSimilarity = new Map<string, number>()
    for (const si of similarUserInteractions) {
      const w = INTERACTION_WEIGHTS[si.type] ?? 1
      userSimilarity.set(si.userId, (userSimilarity.get(si.userId) ?? 0) + w)
    }

    // Get what similar users interacted with (excluding already seen)
    const similarUserIds = [...userSimilarity.keys()]
    if (similarUserIds.length > 0) {
      const collaborativeInteractions = await db.userInteraction.findMany({
        where: {
          userId: { in: similarUserIds },
          workerId: { notIn: [...interactedWorkerIds] },
        },
        select: { userId: true, workerId: true, type: true },
      })

      for (const ci of collaborativeInteractions) {
        const similarity = userSimilarity.get(ci.userId) ?? 1
        const weight = INTERACTION_WEIGHTS[ci.type] ?? 1
        scores.set(ci.workerId, (scores.get(ci.workerId) ?? 0) + similarity * weight)
      }
    }
  }

  // Get user's location for personalization
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { locationId: true, location: { select: { city: true, country: true } } },
  })

  // If no collaborative results, fall back to popular workers in user's location/globally
  if (scores.size === 0) {
    const popular = await db.userInteraction.groupBy({
      by: ['workerId'],
      _count: { workerId: true },
      where: { workerId: { notIn: [...interactedWorkerIds] } },
      orderBy: { _count: { workerId: 'desc' } },
      take: limit * 2,
    })
    for (const p of popular) {
      scores.set(p.workerId, p._count.workerId)
    }
  }

  // Fetch candidate workers
  const candidateIds = [...scores.keys()].slice(0, limit * 3)
  if (candidateIds.length === 0) {
    // Fallback: return recently active workers
    const recent = await db.worker.findMany({
      where: { isActive: true },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { category: true, curator: true },
    })
    const result = { data: recent.map(formatWorker), source: 'fallback' }
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result)).catch(() => {})
    return result
  }

  const workers = await db.worker.findMany({
    where: { id: { in: candidateIds }, isActive: true },
    include: { category: true, curator: true, location: true },
  })

  // Apply location boost
  const scored = workers.map((w) => {
    let score = scores.get(w.id) ?? 0
    if (user?.location && w.location) {
      if (w.location.city === user.location.city) score *= 1.5
      else if (w.location.country === user.location.country) score *= 1.2
    }
    return { worker: w, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, limit).map((s) => formatWorker(s.worker as any))

  const result = { data: top, source: 'collaborative' }
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result)).catch(() => {})
  return result
}
