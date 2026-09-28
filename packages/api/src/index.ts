// Entry point for BlueCollar API
// Tracing must be initialised before any other imports so auto-instrumentation patches load first
import { initializeTracing } from './monitoring/tracing.js'
initializeTracing()

import express from 'express'
import { createServer } from 'http'
import { applySecurity, depthLimiter } from './middleware/security.js'
import { sanitize, sanitizeParams } from './middleware/sanitize.js'
import { env } from './config/env.js'
import pinoHttp from 'pino-http'
import methodOverride from 'method-override'
import passport from './config/passport.js'
import { compress } from './middleware/compress.js'
import authRoutes from './routes/auth.js'
import categoryRoutes from './routes/categories.js'
import workerRoutes from './routes/workers.js'
import portfolioRoutes from './routes/portfolio.js'
import reviewRoutes from './routes/reviews.js'
import subscriptionRoutes from './routes/subscriptions.js'
import messagesRoutes from './routes/messages.js'
import { startAllJobs } from './jobs/index.js'
import { metricsRecorder } from './monitoring/business-metrics.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestId } from './middleware/requestId.js'
import { logger } from './config/logger.js'
import { WebSocketServer } from './websocket/server.js'

const app = express()
const PORT = env.PORT || 3000

app.disable('x-powered-by')
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc,
    },
  },
  hsts: {
    maxAge: 31_536_000,
    includeSubDomains: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
}))

app.use(compress())
app.use(cors(corsConfig))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(requestId)      // generate/propagate X-Request-ID before logging
app.use(pinoHttp())
app.use(methodOverride('X-HTTP-Method'))
app.use(passport.initialize())

app.use('/api/auth', authRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/workers', workerRoutes)
app.use('/api/workers/:workerId/portfolio', portfolioRoutes)
app.use('/api/workers/:workerId/reviews', reviewRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/messages', messagesRoutes)

// Global error handler - must be last
app.use(errorHandler)

if (process.env.NODE_ENV !== 'test') {
  const httpServer = createServer(app)
  new WebSocketServer(httpServer)
  
  httpServer.listen(PORT, () => {
    logger.info(`BlueCollar API running on port ${PORT}`)
    startAllJobs()
    metricsRecorder.startPeriodicSync()
  })
}

export default app
