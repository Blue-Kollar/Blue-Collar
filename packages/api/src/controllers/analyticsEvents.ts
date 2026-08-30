import type { Request, Response } from 'express'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'

interface AnalyticsEvent {
  event: string
  category: string
  properties?: Record<string, unknown>
  timestamp: string
}

/**
 * POST /api/analytics/events — record client events
 * Note: In production, send to a dedicated analytics store (e.g., Mixpanel, Amplitude, or self-hosted ClickHouse)
 */
export const recordEvents = catchAsync(async (req: Request, res: Response) => {
  const { events } = req.body as { events: AnalyticsEvent[] }

  if (!Array.isArray(events) || events.length === 0) {
    throw new AppError('Invalid events payload', 400, true, ErrorCode.VALIDATION_ERROR)
  }

  // TODO: Send to analytics backend (e.g., ClickHouse, Mixpanel, Amplitude)
  // For now, just log to console in dev
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics Events]', JSON.stringify(events, null, 2))
  }

  return res.json({ status: 'success', code: 200 })
})
