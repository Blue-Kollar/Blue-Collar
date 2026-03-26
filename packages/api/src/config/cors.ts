import type { CorsOptions } from 'cors'

const isProduction = process.env.NODE_ENV === 'production'
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : []

export const corsConfig: CorsOptions = {
  origin: isProduction ? (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  } : '*',
}
