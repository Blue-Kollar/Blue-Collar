import type { Request, Response } from 'express'
import { handleError } from '../utils/handleError.js'

interface AnalyticsEvent {
  event: string
  category: string
  properties?: Record<string, any>
  timestamp: string
}

/**
 * POST /api/analytics/events — record client events
 * Note: In production, send to a dedicated analytics store (e.g., Mixpanel, Amplitude, or self-hosted ClickHouse)
 */
export async function recordEvents(req: Request, res: Response) {
  try {
    const { events } = req.body as { events: AnalyticsEvent[] }

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid events payload', code: 400 })
    }

    // TODO: Send to analytics backend (e.g., ClickHouse, Mixpanel, Amplitude)
    // For now, just log to console in dev
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics Events]', JSON.stringify(events, null, 2))
    }

    return res.json({ status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}
