// Entry point for BlueCollar API
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { corsConfig } from './config/cors.js'
import { env } from './config/env.js'
import pinoHttp from 'pino-http'
import methodOverride from 'method-override'
import passport from './config/passport.js'
import authRoutes from './routes/auth.js'
import categoryRoutes from './routes/categories.js'
import workerRoutes from './routes/workers.js'
import portfolioRoutes from './routes/portfolio.js'
import reviewRoutes from './routes/reviews.js'
import subscriptionRoutes from './routes/subscriptions.js'

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

app.use('/api/auth', authRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/workers', workerRoutes)
app.use('/api/workers/:workerId/portfolio', portfolioRoutes)
app.use('/api/workers/:workerId/reviews', reviewRoutes)
app.use('/api/subscriptions', subscriptionRoutes)

// Global error handler - must be last
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`BlueCollar API running on port ${PORT}`)
})
