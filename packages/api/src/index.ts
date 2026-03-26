// Entry point for BlueCollar API
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { corsConfig } from './config/cors.js'
import { env } from './config/env.js'
import pinoHttp from 'pino-http'
import methodOverride from 'method-override'
import passport from './config/passport.js'
import { logger } from './config/logger.js'
import app from './app.js'

const app = express()
const PORT = env.PORT || 3000

// Apply Helmet for HTTP security headers
// strict CSP since we only serve JSON, not HTML
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}))

// Handle 404 errors for unmatched routes
app.use(notFoundHandler)

// Global error handler - must be last
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`BlueCollar API running on port ${PORT}`)
})
