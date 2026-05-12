// financial-ai-backend/src/app.ts
import express from 'express'
import 'express-async-errors'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { authRouter }       from './auth/auth.router'
import { marketRouter }     from './market/market.router'
import { simulationRouter } from './simulation/simulation.router'
import { aiRouter }         from './ai/ai.router'
import { authenticate, authenticateOptional } from './middleware/auth.middleware'
import { errorHandler }     from './middleware/error.middleware'
import { logger }           from './lib/logger'

export function buildApp() {
  const app = express()
  app.set('trust proxy', 1)
  const allowedOrigins = Array.from(new Set([
    'http://localhost:3000',
    'http://localhost:3002',
    ...(process.env.FRONTEND_URL ?? '')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean),
  ]))

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`))
    },
    credentials: true,
  }))
  app.use(helmet())
  app.use(express.json())

  const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false })
  const authLimiter   = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  standardHeaders: true, legacyHeaders: false })

  app.use(globalLimiter)

  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      logger.info('Request', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start, userId: req.user?.userId })
    })
    next()
  })

  app.use('/api/v1/auth',       authLimiter, authRouter)
  app.use('/api/v1/market',     authenticate, marketRouter)
  app.use('/api/v1/simulation', authenticate, simulationRouter)
  app.use('/api/v1/ai',         authenticateOptional, aiRouter)

  app.use(errorHandler)
  return app
}
