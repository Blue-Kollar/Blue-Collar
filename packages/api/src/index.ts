// Entry point for BlueCollar API
import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import pinoHttp from 'pino-http'
import methodOverride from 'method-override'
import passport from './config/passport.js'
import { logger } from './config/logger.js'
import authRoutes from './routes/auth.js'
import categoryRoutes from './routes/categories.js'
import workerRoutes from './routes/workers.js'
import adminRoutes from './routes/admin.js'

const app = express()
const PORT = env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(pinoHttp({ logger }))
app.use(methodOverride('X-HTTP-Method'))
app.use(passport.initialize())

app.use('/api/auth', authRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/workers', workerRoutes)
app.use('/api/admin', adminRoutes)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bluecollar-api' })
})

app.listen(PORT, () => {
  logger.info(`BlueCollar API running on port ${PORT}`)
})

export default app
