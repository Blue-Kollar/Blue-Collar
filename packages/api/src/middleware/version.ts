import type { Request, Response, NextFunction } from 'express'

/**
 * API version configuration
 */
export const VERSION_CONFIG = {
  current: 'v2',
  supported: ['v1', 'v2'] as const,
  deprecated: [] as string[],
  sunset: {
    v1: null as string | null,
    v2: null as string | null,
  },
  rateLimitByVersion: {
    v1: {
      requests: 100,
      windowMs: 60000,
    },
    v2: {
      requests: 150,
      windowMs: 60000,
    },
  },
  authPolicies: {
    v1: {
      allowApiKey: true,
      requireJWT: true,
    },
    v2: {
      allowApiKey: false,
      requireJWT: true,
    },
  },
} as const

/**
 * Request extension for API version
 */
declare global {
  namespace Express {
    interface Request {
      apiVersion?: string
      versionDeprecated?: boolean
      authMethod?: string
      authMetadata?: {
        version: string
        method: string
        timestamp: string
      }
    }
  }
}

/**
 * Middleware: attach the resolved API version to `req` and response headers.
 * Supports URL path versioning (/api/v1, /api/v2) and header-based versioning (Accept-Version).
 */
export function versionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Try URL path versioning first
  let version = extractVersionFromPath(req.path)
  
  // Fall back to header-based versioning (Accept-Version)
  if (!version) {
    version = extractVersionFromHeaders(req)
  }
  
  // Default to current version
  if (!version) {
    version = VERSION_CONFIG.current
  }

  // Validate version
  if (!VERSION_CONFIG.supported.includes(version)) {
    version = VERSION_CONFIG.current
  }

  req.apiVersion = version
  res.setHeader('X-API-Version', version)

  // Check if version is deprecated
  const isDeprecated = VERSION_CONFIG.deprecated.includes(version)
  if (isDeprecated) {
    req.versionDeprecated = true
  }

  next()
}

/**
 * Extract version from URL path
 */
function extractVersionFromPath(path: string): string | null {
  const match = path.match(/^\/api\/(v\d+)\//)
  return match ? match[1] : null
}

/**
 * Extract version from Accept-Version header
 */
function extractVersionFromHeaders(req: Request): string | null {
  const acceptVersion = req.get('Accept-Version')
  if (acceptVersion && VERSION_CONFIG.supported.includes(acceptVersion)) {
    return acceptVersion
  }
  return null
}

/**
 * Middleware: add a deprecation warning header for unversioned /api/* routes.
 * Encourages clients to migrate to /api/v1/*.
 */
export function deprecationWarning(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Deprecation', 'true')
  res.setHeader(
    'Warning',
    '299 - "Unversioned API path is deprecated. Use /api/v1/* instead."',
  )
  res.setHeader('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT')
  next()
}

/**
 * Middleware: add deprecation headers for deprecated versions
 */
export function versionDeprecationMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.versionDeprecated && req.apiVersion) {
    const sunset = VERSION_CONFIG.sunset[req.apiVersion as keyof typeof VERSION_CONFIG.sunset]
    res.setHeader('Deprecation', 'true')
    if (sunset) {
      res.setHeader('Sunset', sunset)
    }
    res.setHeader(
      'Warning',
      `299 - "API version ${req.apiVersion} is deprecated. Migrate to ${VERSION_CONFIG.current}."`,
    )
  }
  next()
}
