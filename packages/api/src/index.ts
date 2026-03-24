// Entry point for BlueCollar API
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import passport from './config/passport.js'
import authRoutes from './routes/auth.js'
import categoryRoutes from './routes/categories.js'
import workerRoutes from './routes/workers.js'
import adminRoutes from './routes/admin.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(passport.initialize())

// Serve static files from storage directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'storage/uploads'
app.use('/storage', express.static(path.resolve('storage')))

app.use('/api/auth', authRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/workers', workerRoutes)
app.use('/api/admin', adminRoutes)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bluecollar-api' })
})

// Handle 404 errors for unmatched routes
app.use(notFoundHandler)

// Global error handler - must be last
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`BlueCollar API running on port ${PORT}`)
})

export default app
