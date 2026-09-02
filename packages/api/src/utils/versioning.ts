import type { Request } from 'express'

import { VERSION_CONFIG } from '../middleware/version.js'

/**
 * Utility functions for API versioning
 */

/**
 * Get the effective API version from a request
 */
export function getApiVersion(req: Request): string {
  return req.apiVersion || VERSION_CONFIG.current
}

/**
 * Check if a version is supported
 */
export function isSupportedVersion(version: string): boolean {
  return VERSION_CONFIG.supported.includes(version)
}

/**
 * Check if a version is deprecated
 */
export function isDeprecatedVersion(version: string): boolean {
  return VERSION_CONFIG.deprecated.includes(version)
}

/**
 * Get all supported versions
 */
export function getSupportedVersions(): string[] {
  return [...VERSION_CONFIG.supported]
}

/**
 * Get all deprecated versions
 */
export function getDeprecatedVersions(): string[] {
  return [...VERSION_CONFIG.deprecated]
}

/**
 * Get the current API version
 */
export function getCurrentVersion(): string {
  return VERSION_CONFIG.current
}

/**
 * Get rate limit config for a specific version
 */
export function getVersionRateLimitConfig(version: string) {
  return VERSION_CONFIG.rateLimitByVersion[version as keyof typeof VERSION_CONFIG.rateLimitByVersion]
}

/**
 * Get sunset date for a version
 */
export function getVersionSunsetDate(version: string): string | null {
  return VERSION_CONFIG.sunset[version as keyof typeof VERSION_CONFIG.sunset] || null
}

/**
 * Check if version is deprecated and get migration info
 */
export function getVersionMigrationInfo(version: string) {
  if (!isDeprecatedVersion(version)) {
    return null
  }

  const sunset = getVersionSunsetDate(version)
  const current = getCurrentVersion()

  return {
    isDeprecated: true,
    currentVersion: current,
    sunset,
    migrateToVersion: current,
  }
}

/**
 * Get authentication policy for a specific version
 */
export function getVersionAuthPolicy(version: string) {
  return VERSION_CONFIG.authPolicies[version as keyof typeof VERSION_CONFIG.authPolicies] || 
    VERSION_CONFIG.authPolicies.v1
}

/**
 * Check if API key is allowed for a specific version
 */
export function isApiKeyAllowedForVersion(version: string): boolean {
  const policy = getVersionAuthPolicy(version)
  return policy?.allowApiKey ?? false
}

/**
 * Check if JWT is required for a specific version
 */
export function isJwtRequiredForVersion(version: string): boolean {
  const policy = getVersionAuthPolicy(version)
  return policy?.requireJWT ?? true
}
