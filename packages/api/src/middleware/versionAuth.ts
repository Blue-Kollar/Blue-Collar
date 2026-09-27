/**
 * Version-specific authentication policy enforcement
 */

import type { Request, Response, NextFunction } from 'express'
import { isApiKeyAllowedForVersion, isJwtRequiredForVersion } from '../utils/versioning.js'

/**
 * Authenticate based on version-specific policies.
 *
 * This middleware does NOT enforce authentication on public routes — it only
 * validates the *method* of authentication when credentials are present.
 * The actual per-route auth guard is handled by `authenticate` in auth.ts.
 */
export function versionAwareAuth(req: Request, res: Response, next: NextFunction) {
  const version = req.apiVersion || 'v1'
  const authHeader = req.get('Authorization') || ''

  // Only enforce auth method rules when credentials are actually provided
  if (!authHeader) return next()

  // API key auth is not allowed in v2+ — reject if provided
  if (authHeader.startsWith('ApiKey ') && !isApiKeyAllowedForVersion(version)) {
    return res.status(401).json({
      status: 'error',
      message: `API version ${version} does not support API key authentication. Please use Bearer JWT instead.`,
      code: 401,
      migratedBearerExample: 'Authorization: Bearer <your-jwt-token>',
      documentation: `/api/${version}/docs`,
    })
  }

  next()
}

/**
 * Validate authentication method compatibility with API version
 */
export function validateAuthMethodForVersion(req: Request, res: Response, next: NextFunction) {
  const version = req.apiVersion || 'v1'
  const authHeader = req.get('Authorization') || ''

  // Store auth method info for later use
  const authMethod = authHeader.split(' ')[0]?.toLowerCase()
  req.authMethod = authMethod

  if (authMethod === 'apikey' && !isApiKeyAllowedForVersion(version)) {
    return res.status(400).json({
      status: 'error',
      message: `API key authentication is not supported in ${version}. Upgrade to JWT Bearer token.`,
      code: 400,
      learnMore: `/api/${version}/docs`,
    })
  }

  next()
}

/**
 * Check authorization level required for endpoint
 */
export function requiredAuthLevel(level: 'authenticated' | 'curator' | 'admin') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
        code: 401,
      })
    }

    if (level === 'authenticated') {
      return next()
    }

    if (level === 'curator' && (user.role === 'curator' || user.role === 'admin')) {
      return next()
    }

    if (level === 'admin' && user.role === 'admin') {
      return next()
    }

    return res.status(403).json({
      status: 'error',
      message: `This endpoint requires ${level} role. You have: ${user.role}`,
      code: 403,
      required: level,
      current: user.role,
    })
  }
}

/**
 * Log authentication method used (for monitoring version migration)
 */
export function logAuthMethodUsage(req: Request, res: Response, next: NextFunction) {
  const version = req.apiVersion || 'v1'
  const authHeader = req.get('Authorization') || ''
  const authMethod = authHeader.split(' ')[0]?.toLowerCase()

  if (authMethod) {
    // Could emit metrics here
    req.authMetadata = {
      version,
      method: authMethod,
      timestamp: new Date().toISOString(),
    }
  }

  next()
}

/**
 * Provide auth guidance headers in responses
 */
export function addAuthGuidanceHeaders(req: Request, res: Response, next: NextFunction) {
  const version = req.apiVersion || 'v1'

  // Add auth guidance if auth was missing
  if (res.statusCode === 401) {
    const jwtRequired = isJwtRequiredForVersion(version)
    const apiKeyAllowed = isApiKeyAllowedForVersion(version)

    let authGuide = 'Supported authentication methods: '
    if (jwtRequired) authGuide += 'Bearer JWT'
    if (apiKeyAllowed) authGuide += (jwtRequired ? ', ' : '') + 'API Key'

    res.set('X-Auth-Guide', authGuide)
    res.set('X-Auth-Docs', `/api/${version}/docs`)

    if (version === 'v2' && apiKeyAllowed === false) {
      res.set('X-Migration-Required', 'true')
      res.set('X-Migration-Message', 'API keys are deprecated. Please migrate to JWT Bearer tokens.')
    }
  }

  next()
}
