// Express type augmentations for BlueCollar API
// These declarations extend the Express Request interface so middleware can attach
// well-typed properties without resorting to `(req as any)` casts.
import type { MediaAsset } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      /** Authenticated user attached by the `authenticate` middleware. */
      user?: { id: string; role: string }

      /**
       * API version extracted from the URL prefix (e.g. 'v1', 'v2').
       * Set by the versioning middleware before any route handler runs.
       */
      apiVersion?: string

      /**
       * Lower-cased auth method extracted from the `Authorization` header
       * (e.g. 'bearer', 'apikey').  Set by `validateAuthMethodForVersion`.
       */
      authMethod?: string

      /**
       * Auth metadata recorded for monitoring/version-migration metrics.
       * Set by `logAuthMethodUsage`.
       */
      authMetadata?: {
        version: string
        method: string
        timestamp: string
      }

      /**
       * Processed media asset attached after `processAndStore` runs.
       * Present only on routes that use the `upload` + `processAndStore`
       * middleware chain.
       */
      mediaAsset?: MediaAsset
    }
  }
}
