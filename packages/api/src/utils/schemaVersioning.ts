/**
 * Request/Response schema transformation utilities for API versioning
 */

import type { Request, Response, NextFunction } from 'express'

/**
 * Define schema transformations between API versions
 */
type JsonObject = Record<string, unknown>

interface SchemaTransformer {
  v1ToV2?: (data: JsonObject) => JsonObject
  v2ToV1?: (data: JsonObject) => JsonObject
}

/**
 * Schema transformation mappings for different endpoints
 */
const transformers: Record<string, SchemaTransformer> = {
  worker: {
    v1ToV2: (worker: JsonObject) => ({
      ...worker,
      verificationStatus: worker.verificationStatus || 'unverified',
    }),
    v2ToV1: (worker: JsonObject) => {
      const { verificationStatus: _verificationStatus, ...rest } = worker
      return rest
    },
  },
  user: {
    v1ToV2: (user: JsonObject) => ({
      ...user,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
    }),
    v2ToV1: (user: JsonObject) => {
      const { twoFactorEnabled: _twoFactorEnabled, ...rest } = user
      return rest
    },
  },
}

/**
 * Transform response data based on target API version
 */
export function transformResponseData(
  data: unknown,
  resourceType: string,
  targetVersion: string,
  sourceVersion: string = 'v1'
): unknown {
  if (!data) return data
  if (targetVersion === sourceVersion) return data

  const transformer = transformers[resourceType]
  if (!transformer) return data

  if (sourceVersion === 'v1' && targetVersion === 'v2') {
    return Array.isArray(data)
      ? data.map(item => transformer.v1ToV2?.(item) ?? item)
      : transformer.v1ToV2?.(data as JsonObject) ?? data
  }

  if (sourceVersion === 'v2' && targetVersion === 'v1') {
    return Array.isArray(data)
      ? data.map(item => transformer.v2ToV1?.(item) ?? item)
      : transformer.v2ToV1?.(data as JsonObject) ?? data
  }

  return data
}

/**
 * Get compatible fields for a version
 * Returns fields that should be included in responses for a given version
 */
export function getCompatibleFields(version: string, resourceType: string): string[] {
  const fieldMapping: Record<string, Record<string, string[]>> = {
    worker: {
      v1: ['id', 'name', 'phone', 'email', 'bio', 'isActive', 'walletAddress', 'avgRating', 'reviewCount', 'categoryId', 'createdAt', 'updatedAt'],
      v2: ['id', 'name', 'phone', 'email', 'bio', 'isActive', 'walletAddress', 'avgRating', 'reviewCount', 'categoryId', 'verificationStatus', 'createdAt', 'updatedAt'],
    },
    user: {
      v1: ['id', 'email', 'firstName', 'lastName', 'role', 'verified'],
      v2: ['id', 'email', 'firstName', 'lastName', 'role', 'verified', 'twoFactorEnabled'],
    },
  }

  return fieldMapping[resourceType]?.[version] ?? []
}

/**
 * Filter response to only include compatible fields
 */
export function filterCompatibleFields(data: unknown, version: string, resourceType: string): unknown {
  const fields = getCompatibleFields(version, resourceType)
  if (!fields.length) return data

  if (Array.isArray(data)) {
    return data.map(item => filterFields(item, fields))
  }

  return filterFields(data as JsonObject, fields)
}

function filterFields(obj: JsonObject, fields: string[]): JsonObject {
  const result: JsonObject = {}
  for (const field of fields) {
    if (field in obj) {
      result[field] = obj[field]
    }
  }
  return result
}

/**
 * Middleware to transform response based on Accept-Version header
 */
export function responseSchemaVersioning(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res)

  res.json = function(data: unknown) {
    const targetVersion = req.apiVersion || 'v1'

    // If response has a data field, transform it
    if (data && typeof data === 'object' && 'data' in data) {
      const resourceType = inferResourceType(req.path)
      if (resourceType) {
        const envelope = data as { data: unknown }
        envelope.data = transformResponseData(envelope.data, resourceType, targetVersion, 'v1')
      }
    }

    return originalJson.call(this, data)
  }

  next()
}

/**
 * Infer resource type from request path
 */
function inferResourceType(path: string): string | null {
  if (path.includes('/workers')) return 'worker'
  if (path.includes('/users')) return 'user'
  if (path.includes('/auth')) return 'user'
  return null
}

/**
 * Validate request payload compatibility with API version.
 * Returns 400 if the payload contains fields that are not valid for the given version.
 */
export function validateRequestSchema(
  data: unknown,
  version: string,
  resourceType: string
): { valid: boolean; errors?: string[] } {
  const compatibleFields = getCompatibleFields(version, resourceType)
  if (!compatibleFields.length) {
    return { valid: true }
  }

  const dataFields = Object.keys((data ?? {}) as JsonObject)
  const invalidFields = dataFields.filter(field => !compatibleFields.includes(field))

  if (invalidFields.length > 0) {
    return {
      valid: false,
      errors: [
        `Invalid fields for ${resourceType} in ${version}: ${invalidFields.join(', ')}`,
      ],
    }
  }

  return { valid: true }
}

/**
 * Express middleware: validate request body against the per-version schema.
 * Attach to routes that accept a request body (POST / PUT / PATCH).
 *
 * Usage:
 *   router.post('/workers', perVersionSchemaValidation('worker'), createWorker)
 */
export function perVersionSchemaValidation(resourceType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const version = req.apiVersion || 'v1'
    const result = validateRequestSchema(req.body, version, resourceType)
    if (!result.valid) {
      return res.status(400).json({
        status: 'error',
        message: 'Request payload contains fields that are not supported in this API version.',
        errors: result.errors,
        version,
        code: 400,
      })
    }
    next()
  }
}

/**
 * Get schema differences between versions
 */
export function getSchemaDifferences(
  resourceType: string,
  v1Fields: string[],
  v2Fields: string[]
): Record<string, string[]> {
  return {
    added: v2Fields.filter(f => !v1Fields.includes(f)),
    removed: v1Fields.filter(f => !v2Fields.includes(f)),
    unchanged: v1Fields.filter(f => v2Fields.includes(f)),
  }
}
