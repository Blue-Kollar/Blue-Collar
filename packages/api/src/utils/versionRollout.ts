/**
 * Version rollout and gradual deployment mechanism
 * Supports canary deployments, traffic splitting, and feature flags
 */

import type { Request, Response, NextFunction } from 'express'

export interface RolloutConfig {
  version: string
  enabled: boolean
  trafficPercentage: number
  userGroups?: string[]
  featureFlags?: Record<string, boolean>
}

/**
 * Rollout configuration for managing gradual deployments
 */
export const ROLLOUT_CONFIG: Record<string, RolloutConfig> = {
  v1: {
    version: 'v1',
    enabled: true,
    trafficPercentage: 100, // v1 is fully available
    featureFlags: {},
  },
  v2: {
    version: 'v2',
    enabled: true,
    trafficPercentage: 100, // v2 is fully available
    featureFlags: {
      verificationStatus: true,
      twoFactorAuth: true,
    },
  },
}

/**
 * Check if version should handle request based on rollout config
 */
export function isVersionEnabled(version: string, userId?: string): boolean {
  const config = ROLLOUT_CONFIG[version]
  if (!config || !config.enabled) return false

  // Check traffic percentage
  if (config.trafficPercentage < 100) {
    // Use consistent hashing for user-based canary
    if (userId) {
      const hash = hashUserId(userId)
      return (hash % 100) < config.trafficPercentage
    }
    // Use random for anonymous
    return Math.random() * 100 < config.trafficPercentage
  }

  return true
}

/**
 * Simple hash function for user ID-based routing
 */
function hashUserId(userId: string): number {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Get canary deployment statistics
 */
export function getCanaryStats(version: string): {
  enabled: boolean
  trafficPercentage: number
  status: 'stable' | 'canary' | 'disabled'
} {
  const config = ROLLOUT_CONFIG[version]
  
  if (!config || !config.enabled) {
    return { enabled: false, trafficPercentage: 0, status: 'disabled' }
  }

  if (config.trafficPercentage === 100) {
    return { enabled: true, trafficPercentage: 100, status: 'stable' }
  }

  return {
    enabled: true,
    trafficPercentage: config.trafficPercentage,
    status: 'canary',
  }
}

/**
 * Middleware to enforce version rollout policies
 */
export function versionRolloutMiddleware(req: Request, res: Response, next: NextFunction) {
  const version = req.apiVersion || 'v1'
  const userId = req.user?.id

  if (!isVersionEnabled(version, userId)) {
    return res.status(503).json({
      status: 'error',
      message: `Version ${version} is not currently available. Please use v1.`,
      code: 503,
      availableVersions: Object.keys(ROLLOUT_CONFIG)
        .filter(v => isVersionEnabled(v, userId))
        .map(v => ({ version: v, ...getCanaryStats(v) })),
    })
  }

  // Store rollout info in request — typed via express.d.ts augmentation.
  // rolloutConfig is not on the default Request; add it if needed, or use
  // a local req.app.locals pattern. For now we attach it as a well-understood
  // side-effect of this middleware only.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rolloutConfig is middleware-specific, not on the shared Request type
  ;(req as any).rolloutConfig = ROLLOUT_CONFIG[version]

  next()
}

/**
 * Get feature flag status for a version
 */
export function isFeatureEnabled(version: string, featureName: string): boolean {
  const config = ROLLOUT_CONFIG[version]
  if (!config) return false
  return config.featureFlags?.[featureName] ?? false
}

/**
 * Middleware to check feature flags
 */
export function featureFlagMiddleware(featureName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const version = req.apiVersion || 'v1'

    if (!isFeatureEnabled(version, featureName)) {
      return res.status(400).json({
        status: 'error',
        message: `Feature ${featureName} is not available in version ${version}`,
        code: 400,
        availableIn: Object.keys(ROLLOUT_CONFIG)
          .filter(v => isFeatureEnabled(v, featureName))
          .map(v => ({ version: v, ...getCanaryStats(v) })),
      })
    }

    next()
  }
}

/**
 * Update rollout configuration at runtime
 */
export function updateRolloutConfig(
  version: string,
  updates: Partial<RolloutConfig>
): RolloutConfig | null {
  if (!(version in ROLLOUT_CONFIG)) {
    return null
  }

  ROLLOUT_CONFIG[version] = {
    ...ROLLOUT_CONFIG[version],
    ...updates,
  }

  return ROLLOUT_CONFIG[version]
}

/**
 * Get current rollout status for all versions
 */
export function getRolloutStatus(): Record<string, RolloutConfig & { status: 'stable' | 'canary' | 'disabled' }> {
  return Object.entries(ROLLOUT_CONFIG).reduce(
    (acc, [version, config]) => {
      acc[version] = {
        version: config.version,
        enabled: config.enabled,
        trafficPercentage: config.trafficPercentage,
        status: getCanaryStats(version).status,
        featureFlags: config.featureFlags || {},
      }
      return acc
    },
    {} as Record<string, RolloutConfig & { status: 'stable' | 'canary' | 'disabled' }>
  )
}

/**
 * Endpoint for querying rollout status
 */
export function getRolloutStatusEndpoint(req: Request, res: Response) {
  const status = getRolloutStatus()
  res.json({
    status: 'success',
    data: status,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Admin endpoint to update rollout configuration
 */
export function updateRolloutEndpoint(req: Request, res: Response) {
  const { version, trafficPercentage, enabled, featureFlags } = req.body

  if (!version) {
    return res.status(400).json({
      status: 'error',
      message: 'version is required',
      code: 400,
    })
  }

  const updated = updateRolloutConfig(version, {
    trafficPercentage,
    enabled,
    featureFlags,
  })

  if (!updated) {
    return res.status(404).json({
      status: 'error',
      message: `Version ${version} not found`,
      code: 404,
    })
  }

  res.json({
    status: 'success',
    message: `Updated rollout config for ${version}`,
    data: updated,
  })
}

/**
 * Gradual rollout helper for phased deployments
 */
export class GradualRollout {
  private version: string
  private phases: Array<{ percentage: number; durationMs: number }>
  private currentPhaseIndex: number
  private phaseStartTime: number

  constructor(version: string, phases: Array<{ percentage: number; durationMs: number }>) {
    this.version = version
    this.phases = phases
    this.currentPhaseIndex = 0
    this.phaseStartTime = Date.now()
  }

  /**
   * Get current phase percentage
   */
  getCurrentPercentage(): number {
    const phase = this.phases[this.currentPhaseIndex]
    return phase?.percentage ?? 0
  }

  /**
   * Advance to next phase if duration has elapsed
   */
  checkAdvance(): boolean {
    if (this.currentPhaseIndex >= this.phases.length - 1) {
      return false
    }

    const currentPhase = this.phases[this.currentPhaseIndex]
    const elapsed = Date.now() - this.phaseStartTime

    if (elapsed > currentPhase.durationMs) {
      this.currentPhaseIndex++
      this.phaseStartTime = Date.now()
      updateRolloutConfig(this.version, {
        trafficPercentage: this.getCurrentPercentage(),
      })
      return true
    }

    return false
  }

  /**
   * Get status of rollout
   */
  getStatus() {
    return {
      version: this.version,
      currentPhase: this.currentPhaseIndex + 1,
      totalPhases: this.phases.length,
      currentPercentage: this.getCurrentPercentage(),
      phases: this.phases,
      timeInCurrentPhase: Date.now() - this.phaseStartTime,
    }
  }
}
