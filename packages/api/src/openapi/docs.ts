import { Router } from 'express'
import swaggerUi from 'swagger-ui-express'

import { buildSpec } from './spec.js'
import { openApiSpecV1, openApiSpecV2 } from './spec-versioned.js'

const router = Router()
const spec = buildSpec()

// Unversioned (defaults to v1 for backward compatibility)
router.get('/docs/openapi.json', (_req, res) => res.json(spec))
router.use('/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'BlueCollar API Docs (v1)' }))

// Versioned endpoints
router.get('/v1/docs/openapi.json', (_req, res) => res.json(openApiSpecV1))
router.use('/v1/docs', swaggerUi.serve, swaggerUi.setup(openApiSpecV1, { customSiteTitle: 'BlueCollar API Docs (v1)' }))

router.get('/v2/docs/openapi.json', (_req, res) => res.json(openApiSpecV2))
router.use('/v2/docs', swaggerUi.serve, swaggerUi.setup(openApiSpecV2, { customSiteTitle: 'BlueCollar API Docs (v2)' }))

export default router
