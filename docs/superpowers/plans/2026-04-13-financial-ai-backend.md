# Financial AI Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure Node.js/TypeScript REST API with JWT auth, portfolio management, live stock/crypto market data (Alpaca + Gemini Exchange), and Google Gemini AI portfolio analysis (chat + summaries).

**Architecture:** Domain-driven modular Express app. Each domain (`auth`, `portfolio`, `market`, `ai`) owns its router, service, and types. Shared infrastructure lives in `lib/`. All inputs validated with Zod before reaching services. `express-async-errors` eliminates try/catch boilerplate in routes.

**Tech Stack:** Node.js, TypeScript 5, Express 4, Prisma 5 + PostgreSQL, bcrypt, jsonwebtoken, @google/generative-ai, axios, Winston, Zod, helmet, express-rate-limit, vitest, supertest

---

## File Map

```
financial-ai-backend/
  prisma/
    schema.prisma                        CREATE - DB schema
  src/
    types/
      express.d.ts                       CREATE - Augments req.user on Express Request
    lib/
      prisma.ts                          CREATE - PrismaClient singleton
      logger.ts                          CREATE - Winston instance (console dev / JSON file prod)
      errors.ts                          CREATE - AppError class
      config.ts                          CREATE - Zod env validation, exits on missing vars
    middleware/
      validate.middleware.ts             CREATE - Zod request body validator factory
      auth.middleware.ts                 CREATE - JWT Bearer verification, attaches req.user
      error.middleware.ts                CREATE - Global error → HTTP response mapper
    auth/
      auth.types.ts                      CREATE - Zod schemas + inferred types
      auth.service.ts                    CREATE - register, login, refresh, logout
      auth.router.ts                     CREATE - POST /register /login /refresh /logout
    market/
      market.types.ts                    CREATE - Price interface, cache types
      gemini.client.ts                   CREATE - Gemini Exchange REST (pubticker)
      alpaca.client.ts                   CREATE - Alpaca REST (quotes/latest)
      market.service.ts                  CREATE - Orchestrates clients + 30s cache
      market.router.ts                   CREATE - GET /crypto/:symbol /stock/:symbol /prices
    portfolio/
      portfolio.types.ts                 CREATE - Zod schemas + inferred types
      portfolio.service.ts               CREATE - Asset upsert, transaction CRUD, price enrichment
      portfolio.router.ts                CREATE - GET / POST DELETE /assets /transactions
    ai/
      ai.types.ts                        CREATE - Zod schemas + inferred types
      ai.service.ts                      CREATE - Google Gemini AI chat + summary
      ai.router.ts                       CREATE - POST /chat GET /summary
    app.ts                               CREATE - Express app factory (buildApp)
    server.ts                            CREATE - HTTP listen + graceful shutdown
    test/
      setup.ts                           CREATE - Vitest global mocks (prisma, config)
      auth.test.ts                       CREATE - Auth route tests
      market.test.ts                     CREATE - Market route tests
      portfolio.test.ts                  CREATE - Portfolio route tests
```

---

## Task 1: Prisma Schema

**Files:**
- Create: `financial-ai-backend/prisma/schema.prisma`

- [ ] **Step 1: Create the Prisma schema file**

```prisma
// financial-ai-backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  passwordHash  String
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  assets        Asset[]
  transactions  Transaction[]
  refreshTokens RefreshToken[]
}

model Asset {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  symbol       String
  type         AssetType
  quantity     Decimal       @db.Decimal(18, 8)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  transactions Transaction[]

  @@unique([userId, symbol])
}

model Transaction {
  id        String          @id @default(cuid())
  userId    String
  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  assetId   String
  asset     Asset           @relation(fields: [assetId], references: [id], onDelete: Cascade)
  type      TransactionType
  quantity  Decimal         @db.Decimal(18, 8)
  price     Decimal         @db.Decimal(18, 8)
  timestamp DateTime        @default(now())
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

enum AssetType       { STOCK  CRYPTO }
enum TransactionType { BUY    SELL   }
```

- [ ] **Step 2: Generate the Prisma client**

```bash
cd "c:/Users/solag/OneDrive/Desktop/CS Projects/IS219/LMNext/financial-ai-backend" && npx prisma generate
```

Expected output: `✔ Generated Prisma Client (v5.x.x) to ./node_modules/@prisma/client`

- [ ] **Step 3: Commit**

```bash
git add financial-ai-backend/prisma/schema.prisma
git commit -m "feat: add Prisma schema (User, Asset, Transaction, RefreshToken)"
```

---

## Task 2: Install Google Gemini AI + Update .env.example

**Files:**
- Modify: `financial-ai-backend/package.json` (via npm install)
- Modify: `financial-ai-backend/.env.example`

- [ ] **Step 1: Install @google/generative-ai**

```bash
cd "c:/Users/solag/OneDrive/Desktop/CS Projects/IS219/LMNext/financial-ai-backend" && npm install @google/generative-ai
```

Expected: `added N packages, found 0 vulnerabilities`

- [ ] **Step 2: Replace .env.example contents**

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/financial_ai

# Auth (both must be at least 32 characters, and must be different)
JWT_SECRET=change-me-to-a-random-32-plus-char-secret
JWT_REFRESH_SECRET=change-me-to-a-different-random-32-plus-char-secret

# Gemini Exchange (crypto market data — https://exchange.gemini.com)
GEMINI_API_KEY=your-gemini-exchange-api-key
GEMINI_API_SECRET=your-gemini-exchange-api-secret

# Alpaca (stock market data — https://alpaca.markets)
ALPACA_KEY=your-alpaca-key
ALPACA_SECRET=your-alpaca-secret

# Google Gemini AI (https://aistudio.google.com/app/apikey)
GOOGLE_GEMINI_API_KEY=your-google-gemini-api-key

# Server
PORT=3001
NODE_ENV=development
```

- [ ] **Step 3: Commit**

```bash
git add financial-ai-backend/package.json financial-ai-backend/package-lock.json financial-ai-backend/.env.example
git commit -m "feat: add @google/generative-ai dep, update .env.example"
```

---

## Task 3: Shared Infrastructure

**Files:**
- Create: `financial-ai-backend/src/lib/prisma.ts`
- Create: `financial-ai-backend/src/lib/logger.ts`
- Create: `financial-ai-backend/src/lib/errors.ts`
- Create: `financial-ai-backend/src/lib/config.ts`

- [ ] **Step 1: Create Prisma singleton**

```typescript
// financial-ai-backend/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

export const prisma: PrismaClient =
  global.__prisma ?? (global.__prisma = new PrismaClient())
```

- [ ] **Step 2: Create Winston logger**

```typescript
// financial-ai-backend/src/lib/logger.ts
import winston from 'winston'

const { combine, timestamp, colorize, printf, json } = winston.format

const devFormat = combine(
  colorize(),
  timestamp(),
  printf(({ level, message, timestamp, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
    return `${timestamp} ${level}: ${message}${extra}`
  })
)

const prodFormat = combine(timestamp(), json())

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    process.env.NODE_ENV === 'production'
      ? new winston.transports.File({ filename: 'logs/app.log', format: prodFormat })
      : new winston.transports.Console({ format: devFormat }),
  ],
})
```

- [ ] **Step 3: Create AppError class**

```typescript
// financial-ai-backend/src/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'AppError'
    Object.setPrototypeOf(this, AppError.prototype)
  }
}
```

- [ ] **Step 4: Create env config with Zod validation**

```typescript
// financial-ai-backend/src/lib/config.ts
import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_API_SECRET: z.string().min(1),
  ALPACA_KEY: z.string().min(1),
  ALPACA_SECRET: z.string().min(1),
  GOOGLE_GEMINI_API_KEY: z.string().min(1),
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data
```

- [ ] **Step 5: Commit**

```bash
git add financial-ai-backend/src/lib/
git commit -m "feat: add shared lib (prisma, logger, AppError, config)"
```

---

## Task 4: Middleware + Express Type Augmentation

**Files:**
- Create: `financial-ai-backend/src/types/express.d.ts`
- Create: `financial-ai-backend/src/middleware/validate.middleware.ts`
- Create: `financial-ai-backend/src/middleware/auth.middleware.ts`
- Create: `financial-ai-backend/src/middleware/error.middleware.ts`

- [ ] **Step 1: Augment Express Request with user field**

```typescript
// financial-ai-backend/src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string }
    }
  }
}

export {}
```

- [ ] **Step 2: Create Zod validation middleware**

```typescript
// financial-ai-backend/src/middleware/validate.middleware.ts
import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'
import { AppError } from '../lib/errors'

export const validate =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const message = result.error.errors.map((e) => e.message).join(', ')
      next(new AppError(message, 400, 'VALIDATION_ERROR'))
      return
    }
    req.body = result.data
    next()
  }
```

- [ ] **Step 3: Create JWT auth middleware**

```typescript
// financial-ai-backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../lib/config'
import { AppError } from '../lib/errors'

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    next(new AppError('Missing or invalid Authorization header', 401, 'UNAUTHORIZED'))
    return
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as { userId: string }
    req.user = { userId: payload.userId }
    next()
  } catch {
    next(new AppError('Invalid or expired token', 401, 'TOKEN_INVALID'))
  }
}
```

- [ ] **Step 4: Create global error handler**

```typescript
// financial-ai-backend/src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    logger.warn(err.message, { code: err.code, statusCode: err.statusCode })
    res.status(err.statusCode).json({ error: err.message, code: err.code })
    return
  }

  logger.error('Unhandled error', { message: err.message, stack: err.stack })

  const message =
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  res.status(500).json({ error: message })
}
```

- [ ] **Step 5: Commit**

```bash
git add financial-ai-backend/src/types/ financial-ai-backend/src/middleware/
git commit -m "feat: add validate, authenticate, and error handler middleware"
```

---

## Task 5: Test Setup

**Files:**
- Modify: `financial-ai-backend/src/test/setup.ts`

- [ ] **Step 1: Create vitest global setup with mocked prisma and config**

```typescript
// financial-ai-backend/src/test/setup.ts
import { vi, beforeEach } from 'vitest'

vi.mock('../lib/config', () => ({
  config: {
    DATABASE_URL: 'postgresql://test',
    JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long!!',
    JWT_REFRESH_SECRET: 'test-refresh-that-is-at-least-32-chars-long!!',
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_API_SECRET: 'test-gemini-secret',
    ALPACA_KEY: 'test-alpaca-key',
    ALPACA_SECRET: 'test-alpaca-secret',
    GOOGLE_GEMINI_API_KEY: 'test-google-gemini-key',
    PORT: '3001',
    NODE_ENV: 'test' as const,
  },
}))

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    asset: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})
```

- [ ] **Step 2: Verify vitest.config.ts already points to setup file**

Open `financial-ai-backend/vitest.config.ts`. Confirm it contains `setupFiles: ['./src/test/setup.ts']`. No edit needed.

- [ ] **Step 3: Commit**

```bash
git add financial-ai-backend/src/test/setup.ts
git commit -m "feat: add vitest global setup with prisma and config mocks"
```

---

## Task 6: Auth Domain

**Files:**
- Create: `financial-ai-backend/src/auth/auth.types.ts`
- Create: `financial-ai-backend/src/auth/auth.service.ts`
- Create: `financial-ai-backend/src/auth/auth.router.ts`
- Create: `financial-ai-backend/src/test/auth.test.ts`

- [ ] **Step 1: Write failing auth tests**

```typescript
// financial-ai-backend/src/test/auth.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import 'express-async-errors'
import bcrypt from 'bcrypt'
import { authRouter } from '../auth/auth.router'
import { errorHandler } from '../middleware/error.middleware'
import { prisma } from '../lib/prisma'

const app = express()
app.use(express.json())
app.use('/api/v1/auth', authRouter)
app.use(errorHandler)

const mock = prisma as any

describe('POST /api/v1/auth/register', () => {
  it('returns 201 with user on success', async () => {
    mock.user.findUnique.mockResolvedValue(null)
    mock.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      createdAt: new Date(),
    })

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'Password123!' })

    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe('test@example.com')
  })

  it('returns 409 when email is already taken', async () => {
    mock.user.findUnique.mockResolvedValue({ id: 'existing' })

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'exists@example.com', password: 'Password123!' })

    expect(res.status).toBe(409)
  })

  it('returns 400 for invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: '123' })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/v1/auth/login', () => {
  it('returns 200 with accessToken and refreshToken', async () => {
    const hash = await bcrypt.hash('Password123!', 10)
    mock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: hash,
    })
    mock.refreshToken.create.mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'Password123!' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('accessToken')
    expect(res.body).toHaveProperty('refreshToken')
  })

  it('returns 401 for wrong password', async () => {
    const hash = await bcrypt.hash('correct-pass', 10)
    mock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: hash,
    })

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'wrong-pass' })

    expect(res.status).toBe(401)
  })

  it('returns 401 for unknown email', async () => {
    mock.user.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123!' })

    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/auth/logout', () => {
  it('returns 204 and deletes the refresh token', async () => {
    mock.refreshToken.deleteMany.mockResolvedValue({ count: 1 })

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'some-raw-token' })

    expect(res.status).toBe(204)
    expect(mock.refreshToken.deleteMany).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd "c:/Users/solag/OneDrive/Desktop/CS Projects/IS219/LMNext/financial-ai-backend" && npm test -- src/test/auth.test.ts
```

Expected: FAIL — `Cannot find module '../auth/auth.router'`

- [ ] **Step 3: Create auth types and Zod schemas**

```typescript
// financial-ai-backend/src/auth/auth.types.ts
import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
})

export type RegisterBody = z.infer<typeof registerSchema>
export type LoginBody = z.infer<typeof loginSchema>
export type RefreshBody = z.infer<typeof refreshSchema>
export type LogoutBody = z.infer<typeof logoutSchema>
```

- [ ] **Step 4: Create auth service**

Refresh tokens are stored as SHA-256 hashes — high-entropy random tokens don't need bcrypt, and SHA-256 enables O(1) DB lookup.

```typescript
// financial-ai-backend/src/auth/auth.service.ts
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { config } from '../lib/config'
import { AppError } from '../lib/errors'
import type { RegisterBody, LoginBody, RefreshBody, LogoutBody } from './auth.types'

const BCRYPT_ROUNDS = 12
const ACCESS_TTL = '15m'
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000

function signAccess(userId: string): string {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: ACCESS_TTL })
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export const authService = {
  async register(body: RegisterBody) {
    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) throw new AppError('Email already in use', 409, 'EMAIL_TAKEN')

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS)
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    })
    return { user }
  },

  async login(body: LoginBody) {
    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')

    const valid = await bcrypt.compare(body.password, user.passwordHash)
    if (!valid) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')

    const rawToken = crypto.randomBytes(40).toString('hex')
    await prisma.refreshToken.create({
      data: {
        token: hashToken(rawToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    })

    return { accessToken: signAccess(user.id), refreshToken: rawToken }
  },

  async refresh(body: RefreshBody) {
    const record = await prisma.refreshToken.findUnique({
      where: { token: hashToken(body.refreshToken) },
    })
    if (!record || record.expiresAt < new Date()) {
      throw new AppError('Invalid or expired refresh token', 401, 'REFRESH_INVALID')
    }

    const rawNew = crypto.randomBytes(40).toString('hex')
    await prisma.refreshToken.delete({ where: { token: hashToken(body.refreshToken) } })
    await prisma.refreshToken.create({
      data: {
        token: hashToken(rawNew),
        userId: record.userId,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    })

    return { accessToken: signAccess(record.userId), refreshToken: rawNew }
  },

  async logout(body: LogoutBody) {
    await prisma.refreshToken.deleteMany({ where: { token: hashToken(body.refreshToken) } })
  },
}
```

- [ ] **Step 5: Create auth router**

```typescript
// financial-ai-backend/src/auth/auth.router.ts
import { Router, Request, Response } from 'express'
import { authService } from './auth.service'
import { validate } from '../middleware/validate.middleware'
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  type RegisterBody,
  type LoginBody,
  type RefreshBody,
  type LogoutBody,
} from './auth.types'

export const authRouter = Router()

authRouter.post(
  '/register',
  validate(registerSchema),
  async (req: Request, res: Response) => {
    const result = await authService.register(req.body as RegisterBody)
    res.status(201).json(result)
  }
)

authRouter.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response) => {
    const result = await authService.login(req.body as LoginBody)
    res.json(result)
  }
)

authRouter.post(
  '/refresh',
  validate(refreshSchema),
  async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body as RefreshBody)
    res.json(result)
  }
)

authRouter.post(
  '/logout',
  validate(logoutSchema),
  async (req: Request, res: Response) => {
    await authService.logout(req.body as LogoutBody)
    res.status(204).send()
  }
)
```

- [ ] **Step 6: Run tests — confirm they pass**

```bash
cd "c:/Users/solag/OneDrive/Desktop/CS Projects/IS219/LMNext/financial-ai-backend" && npm test -- src/test/auth.test.ts
```

Expected: PASS — 6 tests passing

- [ ] **Step 7: Commit**

```bash
git add financial-ai-backend/src/auth/ financial-ai-backend/src/test/auth.test.ts
git commit -m "feat: auth domain (register, login, refresh, logout) with tests"
```

---

## Task 7: Market Domain

**Files:**
- Create: `financial-ai-backend/src/market/market.types.ts`
- Create: `financial-ai-backend/src/market/gemini.client.ts`
- Create: `financial-ai-backend/src/market/alpaca.client.ts`
- Create: `financial-ai-backend/src/market/market.service.ts`
- Create: `financial-ai-backend/src/market/market.router.ts`
- Create: `financial-ai-backend/src/test/market.test.ts`

- [ ] **Step 1: Write failing market tests**

```typescript
// financial-ai-backend/src/test/market.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import 'express-async-errors'
import jwt from 'jsonwebtoken'
import { marketRouter } from '../market/market.router'
import { errorHandler } from '../middleware/error.middleware'
import { authenticate } from '../middleware/auth.middleware'

const app = express()
app.use(express.json())
app.use('/api/v1/market', authenticate, marketRouter)
app.use(errorHandler)

const JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!'
const token = jwt.sign({ userId: 'user-1' }, JWT_SECRET)

vi.mock('../market/gemini.client', () => ({
  geminiClient: {
    getSpotPrice: vi.fn(),
  },
}))

vi.mock('../market/alpaca.client', () => ({
  alpacaClient: {
    getLatestQuote: vi.fn(),
  },
}))

describe('GET /api/v1/market/crypto/:symbol', () => {
  it('returns price for valid symbol', async () => {
    const { geminiClient } = await import('../market/gemini.client')
    ;(geminiClient.getSpotPrice as any).mockResolvedValue({
      symbol: 'BTCUSD',
      price: 65000,
      type: 'CRYPTO',
      timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .get('/api/v1/market/crypto/BTCUSD')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.symbol).toBe('BTCUSD')
    expect(res.body.price).toBe(65000)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/market/crypto/BTCUSD')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/market/stock/:symbol', () => {
  it('returns price for valid symbol', async () => {
    const { alpacaClient } = await import('../market/alpaca.client')
    ;(alpacaClient.getLatestQuote as any).mockResolvedValue({
      symbol: 'AAPL',
      price: 185.5,
      type: 'STOCK',
      timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .get('/api/v1/market/stock/AAPL')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.symbol).toBe('AAPL')
    expect(res.body.price).toBe(185.5)
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd "c:/Users/solag/OneDrive/Desktop/CS Projects/IS219/LMNext/financial-ai-backend" && npm test -- src/test/market.test.ts
```

Expected: FAIL — `Cannot find module '../market/market.router'`

- [ ] **Step 3: Create market types and in-memory cache**

```typescript
// financial-ai-backend/src/market/market.types.ts
export interface Price {
  symbol: string
  price: number
  type: 'STOCK' | 'CRYPTO'
  timestamp: string
}

interface CacheEntry {
  value: Price
  expiresAt: number
}

const store = new Map<string, CacheEntry>()
const TTL_MS = 30_000

export const priceCache = {
  get(key: string): Price | null {
    const entry = store.get(key)
    if (!entry || entry.expiresAt < Date.now()) return null
    return entry.value
  },
  set(key: string, value: Price): void {
    store.set(key, { value, expiresAt: Date.now() + TTL_MS })
  },
}
```

- [ ] **Step 4: Create Gemini Exchange client**

```typescript
// financial-ai-backend/src/market/gemini.client.ts
import axios from 'axios'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'
import type { Price } from './market.types'

const BASE = 'https://api.gemini.com/v1'

export const geminiClient = {
  async getSpotPrice(symbol: string): Promise<Price> {
    const start = Date.now()
    try {
      const { data } = await axios.get(`${BASE}/pubticker/${symbol}`)
      logger.debug('Gemini Exchange fetch', { symbol, ms: Date.now() - start })
      return {
        symbol: symbol.toUpperCase(),
        price: parseFloat(data.last),
        type: 'CRYPTO',
        timestamp: new Date().toISOString(),
      }
    } catch (err: any) {
      logger.error('Gemini Exchange error', { symbol, message: err.message })
      throw new AppError(`Failed to fetch crypto price for ${symbol}`, 502, 'UPSTREAM_ERROR')
    }
  },
}
```

- [ ] **Step 5: Create Alpaca client**

```typescript
// financial-ai-backend/src/market/alpaca.client.ts
import axios from 'axios'
import { config } from '../lib/config'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'
import type { Price } from './market.types'

const BASE = 'https://data.alpaca.markets/v2'

const headers = () => ({
  'APCA-API-KEY-ID': config.ALPACA_KEY,
  'APCA-API-SECRET-KEY': config.ALPACA_SECRET,
})

export const alpacaClient = {
  async getLatestQuote(symbol: string): Promise<Price> {
    const start = Date.now()
    try {
      const { data } = await axios.get(
        `${BASE}/stocks/${symbol}/quotes/latest`,
        { headers: headers() }
      )
      const midpoint = (data.quote.ap + data.quote.bp) / 2
      logger.debug('Alpaca fetch', { symbol, ms: Date.now() - start })
      return {
        symbol: symbol.toUpperCase(),
        price: midpoint,
        type: 'STOCK',
        timestamp: new Date().toISOString(),
      }
    } catch (err: any) {
      logger.error('Alpaca error', { symbol, message: err.message })
      throw new AppError(`Failed to fetch stock price for ${symbol}`, 502, 'UPSTREAM_ERROR')
    }
  },
}
```

- [ ] **Step 6: Create market service**

```typescript
// financial-ai-backend/src/market/market.service.ts
import { geminiClient } from './gemini.client'
import { alpacaClient } from './alpaca.client'
import { priceCache } from './market.types'
import type { Price } from './market.types'

export const marketService = {
  async getCryptoPrice(symbol: string): Promise<Price> {
    const cached = priceCache.get(`crypto:${symbol}`)
    if (cached) return cached
    const price = await geminiClient.getSpotPrice(symbol)
    priceCache.set(`crypto:${symbol}`, price)
    return price
  },

  async getStockPrice(symbol: string): Promise<Price> {
    const cached = priceCache.get(`stock:${symbol}`)
    if (cached) return cached
    const price = await alpacaClient.getLatestQuote(symbol)
    priceCache.set(`stock:${symbol}`, price)
    return price
  },

  async getPriceForAsset(symbol: string, type: 'STOCK' | 'CRYPTO'): Promise<Price> {
    return type === 'CRYPTO'
      ? this.getCryptoPrice(symbol)
      : this.getStockPrice(symbol)
  },
}
```

- [ ] **Step 7: Create market router**

```typescript
// financial-ai-backend/src/market/market.router.ts
import { Router, Request, Response } from 'express'
import { marketService } from './market.service'
import { prisma } from '../lib/prisma'
import { AppError } from '../lib/errors'

export const marketRouter = Router()

marketRouter.get('/crypto/:symbol', async (req: Request, res: Response) => {
  const price = await marketService.getCryptoPrice(req.params.symbol.toUpperCase())
  res.json(price)
})

marketRouter.get('/stock/:symbol', async (req: Request, res: Response) => {
  const price = await marketService.getStockPrice(req.params.symbol.toUpperCase())
  res.json(price)
})

marketRouter.get('/prices', async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const assets = await prisma.asset.findMany({
    where: { userId },
    select: { symbol: true, type: true },
  })

  if (assets.length === 0) {
    res.json([])
    return
  }

  const prices = await Promise.allSettled(
    assets.map((a) => marketService.getPriceForAsset(a.symbol, a.type as 'STOCK' | 'CRYPTO'))
  )

  const result = prices
    .filter((p): p is PromiseFulfilledResult<Awaited<ReturnType<typeof marketService.getPriceForAsset>>> => p.status === 'fulfilled')
    .map((p) => p.value)

  res.json(result)
})
```

- [ ] **Step 8: Run market tests — confirm they pass**

```bash
cd "c:/Users/solag/OneDrive/Desktop/CS Projects/IS219/LMNext/financial-ai-backend" && npm test -- src/test/market.test.ts
```

Expected: PASS — 3 tests passing

- [ ] **Step 9: Commit**

```bash
git add financial-ai-backend/src/market/ financial-ai-backend/src/test/market.test.ts
git commit -m "feat: market domain (Gemini Exchange + Alpaca clients, 30s cache) with tests"
```

---

## Task 8: Portfolio Domain

**Files:**
- Create: `financial-ai-backend/src/portfolio/portfolio.types.ts`
- Create: `financial-ai-backend/src/portfolio/portfolio.service.ts`
- Create: `financial-ai-backend/src/portfolio/portfolio.router.ts`
- Create: `financial-ai-backend/src/test/portfolio.test.ts`

- [ ] **Step 1: Write failing portfolio tests**

```typescript
// financial-ai-backend/src/test/portfolio.test.ts
import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import 'express-async-errors'
import jwt from 'jsonwebtoken'
import { portfolioRouter } from '../portfolio/portfolio.router'
import { errorHandler } from '../middleware/error.middleware'
import { authenticate } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'

vi.mock('../market/market.service', () => ({
  marketService: {
    getPriceForAsset: vi.fn().mockResolvedValue({
      symbol: 'AAPL',
      price: 185,
      type: 'STOCK',
      timestamp: new Date().toISOString(),
    }),
  },
}))

const app = express()
app.use(express.json())
app.use('/api/v1/portfolio', authenticate, portfolioRouter)
app.use(errorHandler)

const JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!'
const token = jwt.sign({ userId: 'user-1' }, JWT_SECRET)
const mock = prisma as any

describe('GET /api/v1/portfolio', () => {
  it('returns enriched assets with prices', async () => {
    mock.asset.findMany.mockResolvedValue([
      { id: 'a-1', symbol: 'AAPL', type: 'STOCK', quantity: '10', createdAt: new Date(), updatedAt: new Date() },
    ])

    const res = await request(app)
      .get('/api/v1/portfolio')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toHaveProperty('currentPrice')
  })
})

describe('POST /api/v1/portfolio/assets', () => {
  it('upserts an asset and returns it', async () => {
    mock.asset.upsert.mockResolvedValue({
      id: 'a-1',
      userId: 'user-1',
      symbol: 'AAPL',
      type: 'STOCK',
      quantity: '10',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await request(app)
      .post('/api/v1/portfolio/assets')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'AAPL', type: 'STOCK', quantity: 10 })

    expect(res.status).toBe(201)
    expect(res.body.symbol).toBe('AAPL')
  })

  it('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/portfolio/assets')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'AAPL' })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/v1/portfolio/transactions', () => {
  it('records a transaction and returns it', async () => {
    mock.asset.findUnique.mockResolvedValue({ id: 'a-1', userId: 'user-1' })
    mock.transaction.create.mockResolvedValue({
      id: 't-1',
      assetId: 'a-1',
      type: 'BUY',
      quantity: '5',
      price: '185',
      timestamp: new Date(),
    })

    const res = await request(app)
      .post('/api/v1/portfolio/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ assetId: 'a-1', type: 'BUY', quantity: 5, price: 185 })

    expect(res.status).toBe(201)
    expect(res.body.type).toBe('BUY')
  })

  it('returns 403 when asset does not belong to user', async () => {
    mock.asset.findUnique.mockResolvedValue({ id: 'a-1', userId: 'other-user' })

    const res = await request(app)
      .post('/api/v1/portfolio/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ assetId: 'a-1', type: 'BUY', quantity: 5, price: 185 })

    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd "c:/Users/solag/OneDrive/Desktop/CS Projects/IS219/LMNext/financial-ai-backend" && npm test -- src/test/portfolio.test.ts
```

Expected: FAIL — `Cannot find module '../portfolio/portfolio.router'`

- [ ] **Step 3: Create portfolio types and Zod schemas**

```typescript
// financial-ai-backend/src/portfolio/portfolio.types.ts
import { z } from 'zod'

export const upsertAssetSchema = z.object({
  symbol: z.string().min(1).toUpperCase(),
  type: z.enum(['STOCK', 'CRYPTO']),
  quantity: z.number().positive('Quantity must be positive'),
})

export const createTransactionSchema = z.object({
  assetId: z.string().min(1),
  type: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
  price: z.number().positive(),
})

export const transactionQuerySchema = z.object({
  symbol: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export type UpsertAssetBody = z.infer<typeof upsertAssetSchema>
export type CreateTransactionBody = z.infer<typeof createTransactionSchema>
export type TransactionQuery = z.infer<typeof transactionQuerySchema>
```

- [ ] **Step 4: Create portfolio service**

```typescript
// financial-ai-backend/src/portfolio/portfolio.service.ts
import { prisma } from '../lib/prisma'
import { marketService } from '../market/market.service'
import { AppError } from '../lib/errors'
import type { UpsertAssetBody, CreateTransactionBody, TransactionQuery } from './portfolio.types'

export const portfolioService = {
  async getPortfolio(userId: string) {
    const assets = await prisma.asset.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })

    const enriched = await Promise.all(
      assets.map(async (asset) => {
        try {
          const price = await marketService.getPriceForAsset(
            asset.symbol,
            asset.type as 'STOCK' | 'CRYPTO'
          )
          return { ...asset, currentPrice: price.price, priceTimestamp: price.timestamp }
        } catch {
          return { ...asset, currentPrice: null, priceTimestamp: null }
        }
      })
    )

    return enriched
  },

  async upsertAsset(userId: string, body: UpsertAssetBody) {
    return prisma.asset.upsert({
      where: { userId_symbol: { userId, symbol: body.symbol } },
      update: { quantity: body.quantity },
      create: { userId, symbol: body.symbol, type: body.type, quantity: body.quantity },
    })
  },

  async deleteAsset(userId: string, assetId: string) {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } })
    if (!asset) throw new AppError('Asset not found', 404, 'NOT_FOUND')
    if (asset.userId !== userId) throw new AppError('Forbidden', 403, 'FORBIDDEN')
    await prisma.asset.delete({ where: { id: assetId } })
  },

  async createTransaction(userId: string, body: CreateTransactionBody) {
    const asset = await prisma.asset.findUnique({ where: { id: body.assetId } })
    if (!asset) throw new AppError('Asset not found', 404, 'NOT_FOUND')
    if (asset.userId !== userId) throw new AppError('Forbidden', 403, 'FORBIDDEN')

    return prisma.transaction.create({
      data: {
        userId,
        assetId: body.assetId,
        type: body.type,
        quantity: body.quantity,
        price: body.price,
      },
    })
  },

  async getTransactions(userId: string, query: TransactionQuery) {
    return prisma.transaction.findMany({
      where: {
        userId,
        ...(query.symbol
          ? { asset: { symbol: query.symbol.toUpperCase() } }
          : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: query.limit,
      skip: query.offset,
      include: { asset: { select: { symbol: true, type: true } } },
    })
  },
}
```

- [ ] **Step 5: Create portfolio router**

```typescript
// financial-ai-backend/src/portfolio/portfolio.router.ts
import { Router, Request, Response } from 'express'
import { portfolioService } from './portfolio.service'
import { validate } from '../middleware/validate.middleware'
import {
  upsertAssetSchema,
  createTransactionSchema,
  transactionQuerySchema,
  type UpsertAssetBody,
  type CreateTransactionBody,
} from './portfolio.types'

export const portfolioRouter = Router()

portfolioRouter.get('/', async (req: Request, res: Response) => {
  const portfolio = await portfolioService.getPortfolio(req.user!.userId)
  res.json(portfolio)
})

portfolioRouter.post(
  '/assets',
  validate(upsertAssetSchema),
  async (req: Request, res: Response) => {
    const asset = await portfolioService.upsertAsset(
      req.user!.userId,
      req.body as UpsertAssetBody
    )
    res.status(201).json(asset)
  }
)

portfolioRouter.delete('/assets/:id', async (req: Request, res: Response) => {
  await portfolioService.deleteAsset(req.user!.userId, req.params.id)
  res.status(204).send()
})

portfolioRouter.post(
  '/transactions',
  validate(createTransactionSchema),
  async (req: Request, res: Response) => {
    const tx = await portfolioService.createTransaction(
      req.user!.userId,
      req.body as CreateTransactionBody
    )
    res.status(201).json(tx)
  }
)

portfolioRouter.get('/transactions', async (req: Request, res: Response) => {
  const parsed = transactionQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query parameters' })
    return
  }
  const txs = await portfolioService.getTransactions(req.user!.userId, parsed.data)
  res.json(txs)
})
```

- [ ] **Step 6: Run portfolio tests — confirm they pass**

```bash
cd "c:/Users/solag/OneDrive/Desktop/CS Projects/IS219/LMNext/financial-ai-backend" && npm test -- src/test/portfolio.test.ts
```

Expected: PASS — 5 tests passing

- [ ] **Step 7: Commit**

```bash
git add financial-ai-backend/src/portfolio/ financial-ai-backend/src/test/portfolio.test.ts
git commit -m "feat: portfolio domain (assets, transactions, price enrichment) with tests"
```

---

## Task 9: AI Domain

**Files:**
- Create: `financial-ai-backend/src/ai/ai.types.ts`
- Create: `financial-ai-backend/src/ai/ai.service.ts`
- Create: `financial-ai-backend/src/ai/ai.router.ts`

- [ ] **Step 1: Create AI types and Zod schemas**

```typescript
// financial-ai-backend/src/ai/ai.types.ts
import { z } from 'zod'

export const chatSchema = z.object({
  message: z.string().min(1).max(2000),
})

export type ChatBody = z.infer<typeof chatSchema>

export interface PortfolioContext {
  assets: Array<{
    symbol: string
    type: string
    quantity: string | number
    currentPrice: number | null
  }>
}

export interface ChatResponse {
  reply: string
}

export interface SummaryResponse {
  summary: string
}
```

- [ ] **Step 2: Create AI service**

```typescript
// financial-ai-backend/src/ai/ai.service.ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from '../lib/config'
import { logger } from '../lib/logger'
import { AppError } from '../lib/errors'
import type { PortfolioContext, ChatResponse, SummaryResponse } from './ai.types'

const genAI = new GoogleGenerativeAI(config.GOOGLE_GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

function buildContext(portfolio: PortfolioContext): string {
  if (portfolio.assets.length === 0) {
    return 'The user has no assets in their portfolio.'
  }
  const lines = portfolio.assets.map(
    (a) =>
      `${a.symbol} (${a.type}): ${a.quantity} units` +
      (a.currentPrice != null ? ` @ $${a.currentPrice.toFixed(2)} current price` : '')
  )
  return `User's portfolio:\n${lines.join('\n')}`
}

export const aiService = {
  async chat(message: string, portfolio: PortfolioContext): Promise<ChatResponse> {
    const context = buildContext(portfolio)
    const prompt = `You are a financial assistant helping a user manage their investment portfolio.\n\n${context}\n\nUser question: ${message}\n\nProvide a clear, concise answer. Do not provide specific financial advice.`

    const start = Date.now()
    try {
      const result = await model.generateContent(prompt)
      const reply = result.response.text()
      logger.debug('Gemini AI chat', { ms: Date.now() - start })
      return { reply }
    } catch (err: any) {
      logger.error('Gemini AI error', { message: err.message })
      throw new AppError('AI service unavailable', 502, 'AI_ERROR')
    }
  },

  async summary(portfolio: PortfolioContext): Promise<SummaryResponse> {
    const context = buildContext(portfolio)
    const prompt = `You are a financial assistant. Given the following portfolio, provide a concise 2-3 sentence summary of the portfolio's composition, any notable concentrations, and overall market exposure. Be factual and brief.\n\n${context}`

    const start = Date.now()
    try {
      const result = await model.generateContent(prompt)
      const summary = result.response.text()
      logger.debug('Gemini AI summary', { ms: Date.now() - start })
      return { summary }
    } catch (err: any) {
      logger.error('Gemini AI error', { message: err.message })
      throw new AppError('AI service unavailable', 502, 'AI_ERROR')
    }
  },
}
```

- [ ] **Step 3: Create AI router**

The router fetches portfolio context, then calls the AI service. No cross-service circular dependencies — the router orchestrates.

```typescript
// financial-ai-backend/src/ai/ai.router.ts
import { Router, Request, Response } from 'express'
import { aiService } from './ai.service'
import { portfolioService } from '../portfolio/portfolio.service'
import { validate } from '../middleware/validate.middleware'
import { chatSchema, type ChatBody } from './ai.types'

export const aiRouter = Router()

aiRouter.post(
  '/chat',
  validate(chatSchema),
  async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const assets = await portfolioService.getPortfolio(userId)
    const portfolio = {
      assets: assets.map((a) => ({
        symbol: a.symbol,
        type: a.type,
        quantity: a.quantity.toString(),
        currentPrice: (a as any).currentPrice ?? null,
      })),
    }
    const result = await aiService.chat((req.body as ChatBody).message, portfolio)
    res.json(result)
  }
)

aiRouter.get('/summary', async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const assets = await portfolioService.getPortfolio(userId)
  const portfolio = {
    assets: assets.map((a) => ({
      symbol: a.symbol,
      type: a.type,
      quantity: a.quantity.toString(),
      currentPrice: (a as any).currentPrice ?? null,
    })),
  }
  const result = await aiService.summary(portfolio)
  res.json(result)
})
```

- [ ] **Step 4: Commit**

```bash
git add financial-ai-backend/src/ai/
git commit -m "feat: AI domain (Google Gemini AI chat + portfolio summary)"
```

---

## Task 10: App Factory + Server

**Files:**
- Create: `financial-ai-backend/src/app.ts`
- Create: `financial-ai-backend/src/server.ts`

- [ ] **Step 1: Create Express app factory**

```typescript
// financial-ai-backend/src/app.ts
import express from 'express'
import 'express-async-errors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import { authRouter } from './auth/auth.router'
import { marketRouter } from './market/market.router'
import { portfolioRouter } from './portfolio/portfolio.router'
import { aiRouter } from './ai/ai.router'
import { authenticate } from './middleware/auth.middleware'
import { errorHandler } from './middleware/error.middleware'
import { logger } from './lib/logger'

export function buildApp() {
  const app = express()

  // Security
  app.use(helmet())
  app.use(cookieParser())
  app.use(express.json())

  // Rate limiting
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  })

  app.use(globalLimiter)

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      logger.info('Request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - start,
        userId: req.user?.userId,
      })
    })
    next()
  })

  // Routes
  app.use('/api/v1/auth', authLimiter, authRouter)
  app.use('/api/v1/market', authenticate, marketRouter)
  app.use('/api/v1/portfolio', authenticate, portfolioRouter)
  app.use('/api/v1/ai', authenticate, aiRouter)

  // Global error handler (must be last)
  app.use(errorHandler)

  return app
}
```

- [ ] **Step 2: Create server entry point**

```typescript
// financial-ai-backend/src/server.ts
import { buildApp } from './app'
import { config } from './lib/config'
import { prisma } from './lib/prisma'
import { logger } from './lib/logger'

const app = buildApp()
const port = parseInt(config.PORT, 10)

const server = app.listen(port, () => {
  logger.info(`Server running on port ${port}`, { env: config.NODE_ENV })
})

async function shutdown() {
  logger.info('Shutting down...')
  server.close(async () => {
    await prisma.$disconnect()
    logger.info('Disconnected from database')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
```

- [ ] **Step 3: Commit**

```bash
git add financial-ai-backend/src/app.ts financial-ai-backend/src/server.ts
git commit -m "feat: Express app factory and server entry point with graceful shutdown"
```

---

## Task 11: Full Test Suite + Smoke Check

- [ ] **Step 1: Run all tests**

```bash
cd "c:/Users/solag/OneDrive/Desktop/CS Projects/IS219/LMNext/financial-ai-backend" && npm test
```

Expected: All tests pass. No failures.

If any test fails, read the error output — it will point to a specific assertion. Fix the mismatch in the relevant service or router file.

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd "c:/Users/solag/OneDrive/Desktop/CS Projects/IS219/LMNext/financial-ai-backend" && npx tsc --noEmit
```

Expected: No output (clean compile). If errors appear, fix each one — they will identify type mismatches between files.

- [ ] **Step 3: Verify server starts (requires .env with real values)**

Copy `.env.example` to `.env` and fill in real values, then:

```bash
cd "c:/Users/solag/OneDrive/Desktop/CS Projects/IS219/LMNext/financial-ai-backend" && npm run dev
```

Expected: `Server running on port 3001` in the console.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verified full test suite passes and TypeScript compiles cleanly"
```
