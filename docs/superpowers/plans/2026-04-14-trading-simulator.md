# AI-Powered Trading Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the portfolio module with a multi-account virtual trading simulator supporting real-time market-order execution, order history, and four account-scoped AI agents (Simulator Chat, Trade Coach, Risk Manager, Strategy Generator).

**Architecture:** Single Express app. The `portfolio` module is deleted and replaced by a `simulation` module (`simulation.service.ts`, `simulation.router.ts`, `simulation.types.ts`). Three new Prisma models (`SimulationAccount`, `Position`, `Order`) replace `Asset` and `Transaction` in one migration. Existing `/ai/*` routes and all auth/market middleware are preserved.

**Tech Stack:** Node.js · TypeScript · Express · Prisma (PostgreSQL/Neon) · Vitest · supertest · OpenAI gpt-4o-mini · Google Gemini 1.5-flash · Yahoo Finance · Gemini Exchange

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Modify | `prisma/schema.prisma` | Drop Asset/Transaction/TransactionType; add SimulationAccount/Position/Order/OrderSide/OrderStatus; update User relation |
| Create | `src/simulation/simulation.types.ts` | All Zod schemas and TypeScript types for the simulation module |
| Create | `src/simulation/simulation.service.ts` | Account CRUD, trade execution, order history, AI context helpers |
| Create | `src/simulation/simulation.router.ts` | All simulation routes including simulation AI sub-routes |
| Create | `src/test/simulation.test.ts` | Tests for account management, trade execution, order history |
| Create | `src/test/simulation-ai.test.ts` | Tests for all four simulation AI routes |
| Modify | `src/test/setup.ts` | Replace asset/transaction Prisma mocks with simulationAccount/position/order |
| Modify | `src/ai/ai.types.ts` | Add SimulationAccountContext, SimulationChatResponse, TradeCoachResponse, RiskManagerResponse, StrategyGeneratorResponse |
| Modify | `src/ai/ai.service.ts` | Add simulationChat, tradeCoach, riskManager, strategyGenerator methods |
| Modify | `src/ai/ai.router.ts` | Replace portfolioService import with simulationService; add simulationChat schema import |
| Modify | `src/test/ai.test.ts` | Add simulationService mock; update beforeEach to mock getAllPositionsForAIContext |
| Modify | `src/app.ts` | Replace portfolioRouter with simulationRouter |
| Delete | `src/portfolio/portfolio.router.ts` | Removed |
| Delete | `src/portfolio/portfolio.service.ts` | Removed |
| Delete | `src/portfolio/portfolio.types.ts` | Removed |

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace schema.prisma**

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
  id                 String              @id @default(cuid())
  email              String              @unique
  passwordHash       String
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  simulationAccounts SimulationAccount[]
  refreshTokens      RefreshToken[]
}

model SimulationAccount {
  id        String     @id @default(cuid())
  userId    String
  name      String
  balance   Decimal    @default(10000.00) @db.Decimal(18, 2)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  positions Position[]
  orders    Order[]

  @@unique([userId, name])
}

model Position {
  id        String            @id @default(cuid())
  accountId String
  symbol    String
  type      AssetType
  quantity  Decimal           @db.Decimal(18, 8)
  avgCost   Decimal           @db.Decimal(18, 8)
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt
  account   SimulationAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([accountId, symbol])
}

model Order {
  id         String            @id @default(cuid())
  accountId  String
  symbol     String
  assetType  AssetType
  side       OrderSide
  quantity   Decimal           @db.Decimal(18, 8)
  fillPrice  Decimal           @db.Decimal(18, 8)
  totalValue Decimal           @db.Decimal(18, 2)
  status     OrderStatus       @default(FILLED)
  createdAt  DateTime          @default(now())
  account    SimulationAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([accountId])
  @@index([accountId, symbol])
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}

enum AssetType {
  STOCK
  CRYPTO
}

enum OrderSide {
  BUY
  SELL
}

enum OrderStatus {
  FILLED
}
```

- [ ] **Step 2: Run migration**

```bash
cd financial-ai-backend
npx prisma migrate dev --name trading-simulator
```

Expected output:
```
Applying migration `..._trading-simulator`
Your database is now in sync with your schema.
✔ Generated Prisma Client
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: migrate schema to trading simulator (SimulationAccount, Position, Order)"
```

---

## Task 2: Simulation Types

**Files:**
- Create: `src/simulation/simulation.types.ts`

- [ ] **Step 1: Create simulation.types.ts**

```typescript
// financial-ai-backend/src/simulation/simulation.types.ts
import { z } from 'zod'

// ── Request schemas ─────────────────────────────────────────────

export const createAccountSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  startingBalance: z.number().positive().optional(),
})

export const tradeSchema = z.object({
  symbol: z.string().min(1).transform(v => v.toUpperCase()),
  type: z.enum(['STOCK', 'CRYPTO']),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
})

export const orderQuerySchema = z.object({
  symbol: z.string().optional(),
  side: z.enum(['BUY', 'SELL']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const riskCheckSchema = z.object({
  symbol: z.string().min(1).transform(v => v.toUpperCase()),
  type: z.enum(['STOCK', 'CRYPTO']),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
})

export type CreateAccountBody = z.infer<typeof createAccountSchema>
export type TradeBody         = z.infer<typeof tradeSchema>
export type OrderQuery        = z.infer<typeof orderQuerySchema>
export type RiskCheckBody     = z.infer<typeof riskCheckSchema>

// ── Response types ──────────────────────────────────────────────

export interface EnrichedPosition {
  id: string
  accountId: string
  symbol: string
  type: string
  quantity: number
  avgCost: number
  currentPrice: number | null
  unrealizedPnL: number | null
  createdAt: Date
  updatedAt: Date
}

export interface AccountSummary {
  id: string
  userId: string
  name: string
  balance: number
  createdAt: Date
  updatedAt: Date
}

export interface AccountDetail extends AccountSummary {
  positions: EnrichedPosition[]
}

export interface FilledOrder {
  id: string
  accountId: string
  symbol: string
  assetType: string
  side: string
  quantity: number
  fillPrice: number
  totalValue: number
  status: string
  createdAt: Date
}
```

- [ ] **Step 2: Commit**

```bash
git add src/simulation/simulation.types.ts
git commit -m "feat: add simulation module types and Zod schemas"
```

---

## Task 3: Update Test Setup

**Files:**
- Modify: `src/test/setup.ts`

- [ ] **Step 1: Replace asset/transaction mocks with simulationAccount/position/order**

Replace the entire file content:

```typescript
// financial-ai-backend/src/test/setup.ts
import { vi, beforeEach } from 'vitest'

vi.mock('../lib/config', () => ({
  config: {
    DATABASE_URL: 'postgresql://test',
    JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long!!',
    GOOGLE_GEMINI_API_KEY: 'test-google-gemini-key',
    OPENAI_API_KEY: 'test-openai-key',
    PORT: '3001',
    NODE_ENV: 'test' as const,
  },
}))

vi.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    simulationAccount: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    position: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    order: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
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

- [ ] **Step 2: Run the existing passing tests to confirm setup change doesn't break auth/market**

```bash
cd financial-ai-backend
npx vitest run src/test/auth.test.ts src/test/market.test.ts
```

Expected: all existing auth and market tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/test/setup.ts
git commit -m "test: update Prisma mock for trading simulator schema"
```

---

## Task 4: Simulation Service — Account Management + Tests

**Files:**
- Create: `src/simulation/simulation.service.ts` (account management methods only)
- Create: `src/test/simulation.test.ts` (account management tests)

- [ ] **Step 1: Write failing tests for account management**

```typescript
// financial-ai-backend/src/test/simulation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import 'express-async-errors'
import jwt from 'jsonwebtoken'
import { simulationRouter } from '../simulation/simulation.router'
import { errorHandler } from '../middleware/error.middleware'
import { authenticate } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'

const app = express()
app.use(express.json())
app.use('/api/v1/simulation', authenticate, simulationRouter)
app.use(errorHandler)

const JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!'
const token = (userId = 'user-1') => jwt.sign({ userId }, JWT_SECRET)

vi.mock('../market/market.service', () => ({
  marketService: { getPriceForAsset: vi.fn() },
}))

import { marketService } from '../market/market.service'

// ── helpers ─────────────────────────────────────────────────────

function makeDecimal(n: number) {
  return { toNumber: () => n, toString: () => String(n) }
}

const mockAccount = {
  id: 'acct-1',
  userId: 'user-1',
  name: 'Test Account',
  balance: makeDecimal(10000),
  createdAt: new Date(),
  updatedAt: new Date(),
  positions: [],
}

// ── Account management ───────────────────────────────────────────

describe('POST /api/v1/simulation/accounts', () => {
  it('creates an account with default balance', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(null)
    ;(prisma as any).simulationAccount.create.mockResolvedValue(mockAccount)

    const res = await request(app)
      .post('/api/v1/simulation/accounts')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Test Account' })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Test Account')
    expect(res.body.balance).toBe(10000)
  })

  it('creates an account with custom startingBalance', async () => {
    const custom = { ...mockAccount, balance: makeDecimal(5000) }
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(null)
    ;(prisma as any).simulationAccount.create.mockResolvedValue(custom)

    const res = await request(app)
      .post('/api/v1/simulation/accounts')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Small Account', startingBalance: 5000 })

    expect(res.status).toBe(201)
    expect(res.body.balance).toBe(5000)
  })

  it('returns 409 for duplicate account name', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(mockAccount)

    const res = await request(app)
      .post('/api/v1/simulation/accounts')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Test Account' })

    expect(res.status).toBe(409)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/accounts')
      .send({ name: 'Test Account' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/simulation/accounts', () => {
  it('returns all accounts for the user', async () => {
    ;(prisma as any).simulationAccount.findMany.mockResolvedValue([mockAccount])

    const res = await request(app)
      .get('/api/v1/simulation/accounts')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('Test Account')
  })
})

describe('GET /api/v1/simulation/accounts/:id', () => {
  it('returns account detail with empty positions', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({ ...mockAccount, positions: [] })

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe('acct-1')
    expect(Array.isArray(res.body.positions)).toBe(true)
  })

  it('returns 404 for account owned by another user', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({ ...mockAccount, userId: 'other-user' })

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1')
      .set('Authorization', `Bearer ${token('user-1')}`)

    expect(res.status).toBe(404)
  })

  it('returns 404 for non-existent account', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/v1/simulation/accounts/bad-id')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/v1/simulation/accounts/:id', () => {
  it('deletes account and returns 204', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(mockAccount)
    ;(prisma as any).simulationAccount.delete.mockResolvedValue(mockAccount)

    const res = await request(app)
      .delete('/api/v1/simulation/accounts/acct-1')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(204)
  })

  it('returns 404 for account owned by another user', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({ ...mockAccount, userId: 'other' })

    const res = await request(app)
      .delete('/api/v1/simulation/accounts/acct-1')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd financial-ai-backend
npx vitest run src/test/simulation.test.ts
```

Expected: FAIL — `simulation.router` not found.

- [ ] **Step 3: Create simulation.service.ts with account management methods**

```typescript
// financial-ai-backend/src/simulation/simulation.service.ts
import { prisma } from '../lib/prisma'
import { marketService } from '../market/market.service'
import { AppError } from '../lib/errors'
import type {
  CreateAccountBody,
  TradeBody,
  OrderQuery,
  EnrichedPosition,
  AccountSummary,
  AccountDetail,
  FilledOrder,
} from './simulation.types'
import type { PortfolioContext, SimulationAccountContext } from '../ai/ai.types'

// ── Helpers ──────────────────────────────────────────────────────

async function enrichPosition(pos: {
  id: string
  accountId: string
  symbol: string
  type: string
  quantity: { toNumber(): number }
  avgCost: { toNumber(): number }
  createdAt: Date
  updatedAt: Date
}): Promise<EnrichedPosition> {
  const quantity = pos.quantity.toNumber()
  const avgCost  = pos.avgCost.toNumber()
  try {
    const price = await marketService.getPriceForAsset(pos.symbol, pos.type as 'STOCK' | 'CRYPTO')
    return {
      id: pos.id, accountId: pos.accountId, symbol: pos.symbol, type: pos.type,
      quantity, avgCost,
      currentPrice: price.price,
      unrealizedPnL: (price.price - avgCost) * quantity,
      createdAt: pos.createdAt, updatedAt: pos.updatedAt,
    }
  } catch {
    return {
      id: pos.id, accountId: pos.accountId, symbol: pos.symbol, type: pos.type,
      quantity, avgCost, currentPrice: null, unrealizedPnL: null,
      createdAt: pos.createdAt, updatedAt: pos.updatedAt,
    }
  }
}

function assertOwner(account: { userId: string } | null, userId: string) {
  if (!account || account.userId !== userId)
    throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND')
}

// ── Service ──────────────────────────────────────────────────────

export const simulationService = {

  async createAccount(userId: string, body: CreateAccountBody): Promise<AccountSummary> {
    const existing = await prisma.simulationAccount.findUnique({
      where: { userId_name: { userId, name: body.name } },
    })
    if (existing) throw new AppError('Account name already in use', 409, 'ACCOUNT_NAME_TAKEN')

    const account = await prisma.simulationAccount.create({
      data: { userId, name: body.name, balance: body.startingBalance ?? 10000 },
    })
    return { ...account, balance: Number(account.balance) }
  },

  async getAccounts(userId: string): Promise<AccountSummary[]> {
    const accounts = await prisma.simulationAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
    return accounts.map(a => ({ ...a, balance: Number(a.balance) }))
  },

  async getAccount(userId: string, accountId: string): Promise<AccountDetail> {
    const account = await prisma.simulationAccount.findUnique({
      where: { id: accountId },
      include: { positions: true },
    })
    assertOwner(account, userId)

    const positions = await Promise.all(account!.positions.map(enrichPosition))
    return {
      id: account!.id, userId: account!.userId, name: account!.name,
      balance: Number(account!.balance),
      createdAt: account!.createdAt, updatedAt: account!.updatedAt,
      positions,
    }
  },

  async deleteAccount(userId: string, accountId: string): Promise<void> {
    const account = await prisma.simulationAccount.findUnique({ where: { id: accountId } })
    assertOwner(account, userId)
    await prisma.simulationAccount.delete({ where: { id: accountId } })
  },

  // Placeholder stubs — implemented in Tasks 5 and 6
  async executeTrade(_userId: string, _accountId: string, _body: TradeBody): Promise<FilledOrder> {
    throw new Error('not implemented')
  },

  async getOrders(_userId: string, _accountId: string, _query: OrderQuery): Promise<FilledOrder[]> {
    throw new Error('not implemented')
  },

  async getAllPositionsForAIContext(_userId: string): Promise<PortfolioContext> {
    throw new Error('not implemented')
  },

  async getAccountForAIContext(_userId: string, _accountId: string): Promise<SimulationAccountContext> {
    throw new Error('not implemented')
  },
}
```

- [ ] **Step 4: Create simulation.router.ts (account routes only — trade/order routes return 501 for now)**

```typescript
// financial-ai-backend/src/simulation/simulation.router.ts
import { Router, Request, Response } from 'express'
import { simulationService } from './simulation.service'
import { aiService } from '../ai/ai.service'
import { marketService } from '../market/market.service'
import { validate } from '../middleware/validate.middleware'
import {
  createAccountSchema,
  tradeSchema,
  orderQuerySchema,
  riskCheckSchema,
  type CreateAccountBody,
  type TradeBody,
  type RiskCheckBody,
} from './simulation.types'
import { chatSchema, type ChatBody } from '../ai/ai.types'

export const simulationRouter = Router()

// ── Accounts ─────────────────────────────────────────────────────

simulationRouter.post(
  '/accounts',
  validate(createAccountSchema),
  async (req: Request, res: Response) => {
    const account = await simulationService.createAccount(req.user!.userId, req.body as CreateAccountBody)
    res.status(201).json(account)
  }
)

simulationRouter.get('/accounts', async (req: Request, res: Response) => {
  const accounts = await simulationService.getAccounts(req.user!.userId)
  res.json(accounts)
})

simulationRouter.get('/accounts/:id', async (req: Request, res: Response) => {
  const account = await simulationService.getAccount(req.user!.userId, req.params.id)
  res.json(account)
})

simulationRouter.delete('/accounts/:id', async (req: Request, res: Response) => {
  await simulationService.deleteAccount(req.user!.userId, req.params.id)
  res.status(204).send()
})

// ── Trade ─────────────────────────────────────────────────────────

simulationRouter.post(
  '/accounts/:id/trade',
  validate(tradeSchema),
  async (req: Request, res: Response) => {
    const order = await simulationService.executeTrade(
      req.user!.userId, req.params.id, req.body as TradeBody
    )
    res.status(201).json(order)
  }
)

// ── Orders ────────────────────────────────────────────────────────

simulationRouter.get('/accounts/:id/orders', async (req: Request, res: Response) => {
  const parsed = orderQuerySchema.safeParse(req.query)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid query parameters' }); return }
  const orders = await simulationService.getOrders(req.user!.userId, req.params.id, parsed.data)
  res.json(orders)
})

// ── Simulation AI ─────────────────────────────────────────────────

simulationRouter.post(
  '/accounts/:id/ai/chat',
  validate(chatSchema),
  async (req: Request, res: Response) => {
    const ctx = await simulationService.getAccountForAIContext(req.user!.userId, req.params.id)
    const result = await aiService.simulationChat((req.body as ChatBody).message, ctx)
    res.json(result)
  }
)

simulationRouter.get('/accounts/:id/ai/coach', async (req: Request, res: Response) => {
  const ctx = await simulationService.getAccountForAIContext(req.user!.userId, req.params.id)
  const result = await aiService.tradeCoach(ctx)
  res.json(result)
})

simulationRouter.post(
  '/accounts/:id/ai/risk',
  validate(riskCheckSchema),
  async (req: Request, res: Response) => {
    const ctx  = await simulationService.getAccountForAIContext(req.user!.userId, req.params.id)
    const body = req.body as RiskCheckBody
    let estimatedValue = 0
    try {
      const price = await marketService.getPriceForAsset(body.symbol, body.type)
      estimatedValue = body.quantity * price.price
    } catch { /* pass 0 if price unavailable */ }
    const result = await aiService.riskManager(ctx, { ...body, estimatedValue })
    res.json(result)
  }
)

simulationRouter.get('/accounts/:id/ai/strategy', async (req: Request, res: Response) => {
  const ctx = await simulationService.getAccountForAIContext(req.user!.userId, req.params.id)
  const result = await aiService.strategyGenerator(ctx)
  res.json(result)
})
```

- [ ] **Step 5: Run account management tests**

```bash
cd financial-ai-backend
npx vitest run src/test/simulation.test.ts
```

Expected: all account management tests PASS (trade/order tests not yet added).

- [ ] **Step 6: Commit**

```bash
git add src/simulation/simulation.service.ts src/simulation/simulation.router.ts src/test/simulation.test.ts
git commit -m "feat: simulation account management (create, list, get, delete) with tests"
```

---

## Task 5: Simulation Service — Trade Execution + Tests

**Files:**
- Modify: `src/simulation/simulation.service.ts` (implement `executeTrade`)
- Modify: `src/test/simulation.test.ts` (add trade execution tests)

- [ ] **Step 1: Add trade execution tests to simulation.test.ts**

Append to `src/test/simulation.test.ts`:

```typescript
// ── Trade execution ──────────────────────────────────────────────

describe('POST /api/v1/simulation/accounts/:id/trade', () => {
  const accountWithBalance = {
    id: 'acct-1',
    userId: 'user-1',
    name: 'Test',
    balance: makeDecimal(10000),
    createdAt: new Date(),
    updatedAt: new Date(),
    positions: [],
  }

  const filledOrder = {
    id: 'order-1',
    accountId: 'acct-1',
    symbol: 'AAPL',
    assetType: 'STOCK',
    side: 'BUY',
    quantity: makeDecimal(10),
    fillPrice: makeDecimal(180),
    totalValue: makeDecimal(1800),
    status: 'FILLED',
    createdAt: new Date(),
  }

  beforeEach(() => {
    vi.mocked(prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma))
  })

  it('executes a BUY order and returns filled order', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(accountWithBalance)
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 180, type: 'STOCK', timestamp: new Date().toISOString(),
    })
    ;(prisma as any).order.create.mockResolvedValue(filledOrder)
    ;(prisma as any).simulationAccount.update.mockResolvedValue({})
    ;(prisma as any).position.upsert.mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/trade')
      .set('Authorization', `Bearer ${token()}`)
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'BUY', quantity: 10 })

    expect(res.status).toBe(201)
    expect(res.body.symbol).toBe('AAPL')
    expect(res.body.side).toBe('BUY')
    expect(res.body.fillPrice).toBe(180)
    expect(res.body.totalValue).toBe(1800)
    expect(res.body.status).toBe('FILLED')
  })

  it('executes a SELL order for an existing position', async () => {
    const accountWithPosition = {
      ...accountWithBalance,
      positions: [{
        id: 'pos-1', accountId: 'acct-1', symbol: 'AAPL', type: 'STOCK',
        quantity: makeDecimal(10), avgCost: makeDecimal(170),
        createdAt: new Date(), updatedAt: new Date(),
      }],
    }
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(accountWithPosition)
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 185, type: 'STOCK', timestamp: new Date().toISOString(),
    })
    const sellOrder = { ...filledOrder, side: 'SELL', fillPrice: makeDecimal(185), totalValue: makeDecimal(1850) }
    ;(prisma as any).order.create.mockResolvedValue(sellOrder)
    ;(prisma as any).simulationAccount.update.mockResolvedValue({})
    ;(prisma as any).position.update.mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/trade')
      .set('Authorization', `Bearer ${token()}`)
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'SELL', quantity: 10 })

    expect(res.status).toBe(201)
    expect(res.body.side).toBe('SELL')
  })

  it('returns 400 for insufficient funds on BUY', async () => {
    const poorAccount = { ...accountWithBalance, balance: makeDecimal(100) }
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(poorAccount)
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 180, type: 'STOCK', timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/trade')
      .set('Authorization', `Bearer ${token()}`)
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'BUY', quantity: 10 })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INSUFFICIENT_FUNDS')
  })

  it('returns 400 for insufficient position on SELL', async () => {
    // No position in AAPL
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(accountWithBalance)
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 180, type: 'STOCK', timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/trade')
      .set('Authorization', `Bearer ${token()}`)
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'SELL', quantity: 5 })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INSUFFICIENT_POSITION')
  })

  it('returns 502 when market price is unavailable', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(accountWithBalance)
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('connection timeout')
    )

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/trade')
      .set('Authorization', `Bearer ${token()}`)
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'BUY', quantity: 10 })

    expect(res.status).toBe(502)
    expect(res.body.code).toBe('MARKET_PRICE_UNAVAILABLE')
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/trade')
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'BUY', quantity: 10 })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run to verify new tests fail**

```bash
cd financial-ai-backend
npx vitest run src/test/simulation.test.ts 2>&1 | tail -20
```

Expected: trade tests FAIL with "not implemented".

- [ ] **Step 3: Implement executeTrade in simulation.service.ts**

Replace the `executeTrade` stub with:

```typescript
async executeTrade(userId: string, accountId: string, body: TradeBody): Promise<FilledOrder> {
  const account = await prisma.simulationAccount.findUnique({
    where: { id: accountId },
    include: { positions: { where: { symbol: body.symbol } } },
  })
  assertOwner(account, userId)

  let fillPrice: number
  try {
    const priceData = await marketService.getPriceForAsset(body.symbol, body.type)
    fillPrice = priceData.price
  } catch {
    throw new AppError('Market price unavailable for this symbol', 502, 'MARKET_PRICE_UNAVAILABLE')
  }

  const totalValue       = body.quantity * fillPrice
  const balance          = Number(account!.balance)
  const existingPosition = account!.positions[0] ?? null

  if (body.side === 'BUY') {
    if (totalValue > balance)
      throw new AppError(
        `Insufficient funds: need $${totalValue.toFixed(2)}, have $${balance.toFixed(2)}`,
        400,
        'INSUFFICIENT_FUNDS'
      )
  } else {
    if (!existingPosition)
      throw new AppError(`No position in ${body.symbol} to sell`, 400, 'INSUFFICIENT_POSITION')
    const heldQty = Number(existingPosition.quantity)
    if (body.quantity > heldQty)
      throw new AppError(
        `Insufficient position: selling ${body.quantity}, holding ${heldQty}`,
        400,
        'INSUFFICIENT_POSITION'
      )
  }

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        accountId,
        symbol:     body.symbol,
        assetType:  body.type,
        side:       body.side,
        quantity:   body.quantity,
        fillPrice,
        totalValue,
        status:     'FILLED',
      },
    })

    if (body.side === 'BUY') {
      await tx.simulationAccount.update({
        where: { id: accountId },
        data:  { balance: { decrement: totalValue } },
      })

      const existingQty     = existingPosition ? Number(existingPosition.quantity)  : 0
      const existingAvgCost = existingPosition ? Number(existingPosition.avgCost)   : 0
      const newQty          = existingQty + body.quantity
      const newAvgCost      = existingQty === 0
        ? fillPrice
        : (existingQty * existingAvgCost + body.quantity * fillPrice) / newQty

      await tx.position.upsert({
        where:  { accountId_symbol: { accountId, symbol: body.symbol } },
        update: { quantity: newQty, avgCost: newAvgCost },
        create: { accountId, symbol: body.symbol, type: body.type, quantity: newQty, avgCost: newAvgCost },
      })
    } else {
      await tx.simulationAccount.update({
        where: { id: accountId },
        data:  { balance: { increment: totalValue } },
      })

      const remainingQty = Number(existingPosition!.quantity) - body.quantity
      if (remainingQty === 0) {
        await tx.position.delete({
          where: { accountId_symbol: { accountId, symbol: body.symbol } },
        })
      } else {
        await tx.position.update({
          where: { accountId_symbol: { accountId, symbol: body.symbol } },
          data:  { quantity: remainingQty },
        })
      }
    }

    return newOrder
  })

  return {
    id:         order.id,
    accountId:  order.accountId,
    symbol:     order.symbol,
    assetType:  order.assetType,
    side:       order.side,
    quantity:   Number(order.quantity),
    fillPrice:  Number(order.fillPrice),
    totalValue: Number(order.totalValue),
    status:     order.status,
    createdAt:  order.createdAt,
  }
},
```

- [ ] **Step 4: Run all simulation tests**

```bash
cd financial-ai-backend
npx vitest run src/test/simulation.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/simulation.service.ts src/test/simulation.test.ts
git commit -m "feat: trade execution with BUY/SELL validation and atomic Prisma transaction"
```

---

## Task 6: Simulation Service — Order History + AI Context Helpers + Tests

**Files:**
- Modify: `src/simulation/simulation.service.ts` (implement remaining stubs)
- Modify: `src/test/simulation.test.ts` (add order history tests)

- [ ] **Step 1: Add order history tests to simulation.test.ts**

Append to `src/test/simulation.test.ts`:

```typescript
// ── Order history ────────────────────────────────────────────────

describe('GET /api/v1/simulation/accounts/:id/orders', () => {
  const mockOrder = {
    id: 'order-1',
    accountId: 'acct-1',
    symbol: 'AAPL',
    assetType: 'STOCK',
    side: 'BUY',
    quantity: makeDecimal(10),
    fillPrice: makeDecimal(180),
    totalValue: makeDecimal(1800),
    status: 'FILLED',
    createdAt: new Date(),
  }

  it('returns paginated order history', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(mockAccount)
    ;(prisma as any).order.findMany.mockResolvedValue([mockOrder])

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/orders')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].symbol).toBe('AAPL')
    expect(res.body[0].fillPrice).toBe(180)
  })

  it('filters by symbol query param', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(mockAccount)
    ;(prisma as any).order.findMany.mockResolvedValue([mockOrder])

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/orders?symbol=AAPL')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body[0].symbol).toBe('AAPL')
  })

  it('returns 404 for account owned by another user', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({ ...mockAccount, userId: 'other' })

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/orders')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(404)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/simulation/accounts/acct-1/orders')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run to verify new tests fail**

```bash
cd financial-ai-backend
npx vitest run src/test/simulation.test.ts 2>&1 | grep -E "PASS|FAIL|not implemented"
```

Expected: order history tests FAIL.

- [ ] **Step 3: Implement getOrders, getAllPositionsForAIContext, getAccountForAIContext in simulation.service.ts**

Replace the three remaining stubs:

```typescript
async getOrders(userId: string, accountId: string, query: OrderQuery): Promise<FilledOrder[]> {
  const account = await prisma.simulationAccount.findUnique({ where: { id: accountId } })
  assertOwner(account, userId)

  const orders = await prisma.order.findMany({
    where: {
      accountId,
      ...(query.symbol ? { symbol: query.symbol.toUpperCase() } : {}),
      ...(query.side   ? { side: query.side }                  : {}),
    },
    orderBy: { createdAt: 'desc' },
    take:    query.limit,
    skip:    query.offset,
  })

  return orders.map(o => ({
    id:         o.id,
    accountId:  o.accountId,
    symbol:     o.symbol,
    assetType:  o.assetType,
    side:       o.side,
    quantity:   Number(o.quantity),
    fillPrice:  Number(o.fillPrice),
    totalValue: Number(o.totalValue),
    status:     o.status,
    createdAt:  o.createdAt,
  }))
},

async getAllPositionsForAIContext(userId: string): Promise<PortfolioContext> {
  const accounts = await prisma.simulationAccount.findMany({
    where: { userId },
    include: { positions: true },
  })

  const allPositions = accounts.flatMap(a => a.positions)

  const enriched = await Promise.all(
    allPositions.map(async (pos) => {
      try {
        const price = await marketService.getPriceForAsset(pos.symbol, pos.type as 'STOCK' | 'CRYPTO')
        return { symbol: pos.symbol, type: pos.type, quantity: Number(pos.quantity), currentPrice: price.price }
      } catch {
        return { symbol: pos.symbol, type: pos.type, quantity: Number(pos.quantity), currentPrice: null }
      }
    })
  )

  return { assets: enriched }
},

async getAccountForAIContext(userId: string, accountId: string): Promise<SimulationAccountContext> {
  const account = await prisma.simulationAccount.findUnique({
    where: { id: accountId },
    include: { positions: true },
  })
  assertOwner(account, userId)

  const recentOrders = await prisma.order.findMany({
    where:   { accountId },
    orderBy: { createdAt: 'desc' },
    take:    10,
  })

  const positions = await Promise.all(account!.positions.map(enrichPosition))

  return {
    name:    account!.name,
    balance: Number(account!.balance),
    positions: positions.map(p => ({
      symbol:       p.symbol,
      type:         p.type,
      quantity:     p.quantity,
      avgCost:      p.avgCost,
      currentPrice: p.currentPrice,
      unrealizedPnL: p.unrealizedPnL,
    })),
    recentOrders: recentOrders.map(o => ({
      orderId:    o.id,
      symbol:     o.symbol,
      side:       o.side,
      quantity:   Number(o.quantity),
      fillPrice:  Number(o.fillPrice),
      totalValue: Number(o.totalValue),
      createdAt:  o.createdAt.toISOString(),
    })),
  }
},
```

- [ ] **Step 4: Run all simulation tests**

```bash
cd financial-ai-backend
npx vitest run src/test/simulation.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/simulation.service.ts src/test/simulation.test.ts
git commit -m "feat: order history and AI context helpers (getOrders, getAllPositionsForAIContext, getAccountForAIContext)"
```

---

## Task 7: AI Types + Simulation AI Service Methods

**Files:**
- Modify: `src/ai/ai.types.ts`
- Modify: `src/ai/ai.service.ts`

- [ ] **Step 1: Add new types to ai.types.ts**

Append to `src/ai/ai.types.ts` (after existing `SuggestionsResponse`):

```typescript
// ── Simulation AI ─────────────────────────────────────────────────

export const simulationChatSchema = z.object({
  message: z.string().min(1).max(2000),
})
export type SimulationChatBody = z.infer<typeof simulationChatSchema>

export interface SimulationAccountContext {
  name: string
  balance: number
  positions: {
    symbol: string
    type: string
    quantity: number
    avgCost: number
    currentPrice: number | null
    unrealizedPnL: number | null
  }[]
  recentOrders: {
    orderId: string
    symbol: string
    side: string
    quantity: number
    fillPrice: number
    totalValue: number
    createdAt: string
  }[]
}

export interface SimulationChatResponse {
  reply: string
}

export interface TradeCoachResponse {
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  strengths: string[]
  weaknesses: string[]
  recentTradeAnalysis: {
    orderId: string
    symbol: string
    assessment: 'good' | 'neutral' | 'poor'
    reasoning: string
  }[]
  coachingTip: string
}

export interface RiskManagerResponse {
  riskLevel: 'low' | 'medium' | 'high' | 'extreme'
  approved: boolean
  warnings: string[]
  positionSizePercent: number
  recommendation: string
}

export interface StrategyGeneratorResponse {
  strategies: {
    name: string
    description: string
    suitability: 'beginner' | 'intermediate' | 'advanced'
    expectedRisk: 'low' | 'medium' | 'high'
    suggestedActions: string[]
  }[]
  rationale: string
}
```

- [ ] **Step 2: Add simulation AI methods to ai.service.ts**

Add these imports at the top of `src/ai/ai.service.ts`:

```typescript
import type {
  PortfolioContext,
  ChatResponse,
  SummaryResponse,
  RiskAnalysisResponse,
  TrendAnalysisResponse,
  SuggestionsResponse,
  SimulationAccountContext,
  SimulationChatResponse,
  TradeCoachResponse,
  RiskManagerResponse,
  StrategyGeneratorResponse,
} from './ai.types'
```

Add these helper and methods to `ai.service.ts` (inside the `aiService` export, after `investmentSuggestions`):

First, add this private helper function above the `aiService` export:

```typescript
function buildSimAccountContext(account: SimulationAccountContext): string {
  const posLines = account.positions.length === 0
    ? 'No open positions.'
    : account.positions
        .map(p =>
          `${p.symbol} (${p.type}): ${p.quantity} units, avg cost $${p.avgCost.toFixed(2)}` +
          (p.currentPrice != null
            ? `, current $${p.currentPrice.toFixed(2)}, unrealized P&L $${(p.unrealizedPnL ?? 0).toFixed(2)}`
            : ' (price unavailable)')
        )
        .join('\n')

  const orderLines = account.recentOrders.length === 0
    ? 'No order history.'
    : account.recentOrders
        .map(o =>
          `[${o.orderId}] ${o.side} ${o.quantity} ${o.symbol} @ $${o.fillPrice.toFixed(2)} ` +
          `(total $${o.totalValue.toFixed(2)}) on ${o.createdAt}`
        )
        .join('\n')

  return `Account: ${account.name}
Cash Balance: $${account.balance.toFixed(2)}

Open Positions:
${posLines}

Recent Orders (last 10):
${orderLines}`
}
```

Then append these four methods inside the `aiService` object:

```typescript
  // ── Simulation AI agents ──────────────────────────────────────

  async simulationChat(message: string, account: SimulationAccountContext): Promise<SimulationChatResponse> {
    const contextStr = buildSimAccountContext(account)
    const prompt = `You are a trading simulator assistant. The user has a virtual trading account:\n\n${contextStr}\n\nUser question: ${message}\n\nGive a clear, educational answer relevant to their simulation. Help them understand trading decisions. Do not give real financial advice.`
    const start = Date.now()
    try {
      const result = await geminiModel.generateContent(prompt)
      logger.debug('Gemini simulation chat', { ms: Date.now() - start })
      return { reply: result.response.text() }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('Gemini simulation chat error', { message: msg })
      throw new AppError('AI service unavailable', 502, 'AI_ERROR')
    }
  },

  async tradeCoach(account: SimulationAccountContext): Promise<TradeCoachResponse> {
    const systemPrompt = `You are a trading coach reviewing a simulated account. Return a JSON object with exactly these fields:
- overallGrade: "A", "B", "C", "D", or "F" based on trading quality
- strengths: array of strings (empty array if nothing to note)
- weaknesses: array of strings (empty array if none)
- recentTradeAnalysis: array of objects, one per order, each with { orderId: string, symbol: string, assessment: "good"|"neutral"|"poor", reasoning: string }
- coachingTip: one concrete actionable improvement tip
Respond with valid JSON only.`
    return callOpenAIAgent<TradeCoachResponse>(systemPrompt, buildSimAccountContext(account))
  },

  async riskManager(
    account: SimulationAccountContext,
    proposedTrade: { symbol: string; type: string; side: string; quantity: number; estimatedValue: number }
  ): Promise<RiskManagerResponse> {
    const systemPrompt = `You are a risk manager evaluating a proposed trade in a simulation account. Return a JSON object with exactly these fields:
- riskLevel: "low", "medium", "high", or "extreme"
- approved: boolean (your recommendation, not enforced)
- warnings: array of strings (empty array if none)
- positionSizePercent: the proposed trade value as a % of total portfolio value (cash + all position values)
- recommendation: one sentence
Respond with valid JSON only.`
    const userContent = `Account context:\n${buildSimAccountContext(account)}\n\nProposed trade: ${JSON.stringify(proposedTrade)}`
    return callOpenAIAgent<RiskManagerResponse>(systemPrompt, userContent)
  },

  async strategyGenerator(account: SimulationAccountContext): Promise<StrategyGeneratorResponse> {
    const systemPrompt = `You are a trading strategist reviewing a simulated account. Return a JSON object with exactly these fields:
- strategies: array of 2-3 objects each with { name: string, description: string, suitability: "beginner"|"intermediate"|"advanced", expectedRisk: "low"|"medium"|"high", suggestedActions: string[] (3-5 items) }
- rationale: one paragraph explaining why these strategies fit this account
Respond with valid JSON only.`
    return callOpenAIAgent<StrategyGeneratorResponse>(systemPrompt, buildSimAccountContext(account))
  },
```

- [ ] **Step 3: Compile-check (no test yet — tests come in Task 8)**

```bash
cd financial-ai-backend
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/ai/ai.types.ts src/ai/ai.service.ts
git commit -m "feat: simulation AI agents (simulationChat, tradeCoach, riskManager, strategyGenerator)"
```

---

## Task 8: Simulation AI Routes Tests

**Files:**
- Create: `src/test/simulation-ai.test.ts`

- [ ] **Step 1: Create simulation-ai.test.ts**

```typescript
// financial-ai-backend/src/test/simulation-ai.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import 'express-async-errors'
import jwt from 'jsonwebtoken'
import { simulationRouter } from '../simulation/simulation.router'
import { errorHandler } from '../middleware/error.middleware'
import { authenticate } from '../middleware/auth.middleware'
import { AppError } from '../lib/errors'

const app = express()
app.use(express.json())
app.use('/api/v1/simulation', authenticate, simulationRouter)
app.use(errorHandler)

const JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!'
const token = (userId = 'user-1') => jwt.sign({ userId }, JWT_SECRET)

vi.mock('../simulation/simulation.service', () => ({
  simulationService: {
    createAccount: vi.fn(),
    getAccounts: vi.fn(),
    getAccount: vi.fn(),
    deleteAccount: vi.fn(),
    executeTrade: vi.fn(),
    getOrders: vi.fn(),
    getAccountForAIContext: vi.fn(),
    getAllPositionsForAIContext: vi.fn(),
  },
}))

vi.mock('../ai/ai.service', () => ({
  aiService: {
    simulationChat: vi.fn(),
    tradeCoach: vi.fn(),
    riskManager: vi.fn(),
    strategyGenerator: vi.fn(),
    chat: vi.fn(),
    summary: vi.fn(),
    riskAnalysis: vi.fn(),
    trendAnalysis: vi.fn(),
    investmentSuggestions: vi.fn(),
  },
}))

vi.mock('../market/market.service', () => ({
  marketService: { getPriceForAsset: vi.fn() },
}))

import { simulationService } from '../simulation/simulation.service'
import { aiService } from '../ai/ai.service'
import { marketService } from '../market/market.service'

const mockAccountContext = {
  name: 'Test Account',
  balance: 8200,
  positions: [
    { symbol: 'AAPL', type: 'STOCK', quantity: 10, avgCost: 180, currentPrice: 185, unrealizedPnL: 50 },
  ],
  recentOrders: [
    { orderId: 'order-1', symbol: 'AAPL', side: 'BUY', quantity: 10, fillPrice: 180, totalValue: 1800, createdAt: new Date().toISOString() },
  ],
}

beforeEach(() => {
  vi.mocked(simulationService.getAccountForAIContext).mockResolvedValue(mockAccountContext)
})

describe('POST /api/v1/simulation/accounts/:id/ai/chat', () => {
  it('returns chat reply with account context', async () => {
    vi.mocked(aiService.simulationChat).mockResolvedValue({ reply: 'Your AAPL position is up $50.' })

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'How is my AAPL doing?' })

    expect(res.status).toBe(200)
    expect(typeof res.body.reply).toBe('string')
    expect(res.body.reply).toContain('AAPL')
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .send({ message: 'Hello' })
    expect(res.status).toBe(401)
  })

  it('returns 502 when AI is unavailable', async () => {
    vi.mocked(aiService.simulationChat).mockRejectedValue(new AppError('AI unavailable', 502, 'AI_ERROR'))

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'Hello' })

    expect(res.status).toBe(502)
  })
})

describe('GET /api/v1/simulation/accounts/:id/ai/coach', () => {
  it('returns trade coach evaluation', async () => {
    const mockCoach = {
      overallGrade: 'B',
      strengths: ['Good entry timing on AAPL'],
      weaknesses: ['Position size too large relative to balance'],
      recentTradeAnalysis: [{ orderId: 'order-1', symbol: 'AAPL', assessment: 'good', reasoning: 'Bought near support.' }],
      coachingTip: 'Limit individual positions to 15% of portfolio.',
    }
    vi.mocked(aiService.tradeCoach).mockResolvedValue(mockCoach)

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/ai/coach')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(['A', 'B', 'C', 'D', 'F']).toContain(res.body.overallGrade)
    expect(Array.isArray(res.body.strengths)).toBe(true)
    expect(Array.isArray(res.body.weaknesses)).toBe(true)
    expect(Array.isArray(res.body.recentTradeAnalysis)).toBe(true)
    expect(typeof res.body.coachingTip).toBe('string')
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/simulation/accounts/acct-1/ai/coach')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/simulation/accounts/:id/ai/risk', () => {
  it('returns risk assessment for a proposed trade', async () => {
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 185, type: 'STOCK', timestamp: new Date().toISOString(),
    })
    const mockRisk = {
      riskLevel: 'medium',
      approved: true,
      warnings: ['Position would represent 22% of portfolio'],
      positionSizePercent: 22,
      recommendation: 'Consider reducing quantity to stay under 20%.',
    }
    vi.mocked(aiService.riskManager).mockResolvedValue(mockRisk)

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/risk')
      .set('Authorization', `Bearer ${token()}`)
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'BUY', quantity: 10 })

    expect(res.status).toBe(200)
    expect(['low', 'medium', 'high', 'extreme']).toContain(res.body.riskLevel)
    expect(typeof res.body.approved).toBe('boolean')
    expect(Array.isArray(res.body.warnings)).toBe(true)
    expect(typeof res.body.positionSizePercent).toBe('number')
    expect(typeof res.body.recommendation).toBe('string')
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/risk')
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'BUY', quantity: 10 })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/simulation/accounts/:id/ai/strategy', () => {
  it('returns strategy suggestions', async () => {
    const mockStrategy = {
      strategies: [
        {
          name: 'Momentum Trading',
          description: 'Buy assets showing strong upward momentum.',
          suitability: 'intermediate',
          expectedRisk: 'medium',
          suggestedActions: ['Screen for 52-week highs', 'Enter on pullbacks', 'Use 5% stop-loss'],
        },
      ],
      rationale: 'Your account history shows short-term trading preference.',
    }
    vi.mocked(aiService.strategyGenerator).mockResolvedValue(mockStrategy)

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/ai/strategy')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.strategies)).toBe(true)
    expect(res.body.strategies.length).toBeGreaterThan(0)
    const s = res.body.strategies[0]
    expect(typeof s.name).toBe('string')
    expect(['beginner', 'intermediate', 'advanced']).toContain(s.suitability)
    expect(['low', 'medium', 'high']).toContain(s.expectedRisk)
    expect(Array.isArray(s.suggestedActions)).toBe(true)
    expect(typeof res.body.rationale).toBe('string')
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/simulation/accounts/acct-1/ai/strategy')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run simulation AI tests**

```bash
cd financial-ai-backend
npx vitest run src/test/simulation-ai.test.ts
```

Expected: all tests PASS (routes and service are already wired).

- [ ] **Step 3: Commit**

```bash
git add src/test/simulation-ai.test.ts
git commit -m "test: simulation AI routes (chat, coach, risk, strategy)"
```

---

## Task 9: Wire Into App + Update AI Router

**Files:**
- Modify: `src/app.ts`
- Modify: `src/ai/ai.router.ts`
- Modify: `src/test/ai.test.ts`

- [ ] **Step 1: Update app.ts — replace portfolioRouter with simulationRouter**

Replace the entire file:

```typescript
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
import { authenticate }     from './middleware/auth.middleware'
import { errorHandler }     from './middleware/error.middleware'
import { logger }           from './lib/logger'

export function buildApp() {
  const app = express()

  app.use(cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
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
  app.use('/api/v1/ai',         authenticate, aiRouter)

  app.use(errorHandler)
  return app
}
```

- [ ] **Step 2: Update ai.router.ts — replace portfolioService with simulationService**

Replace the entire file:

```typescript
// financial-ai-backend/src/ai/ai.router.ts
import { Router, Request, Response } from 'express'
import { aiService }          from './ai.service'
import { simulationService }  from '../simulation/simulation.service'
import { validate }           from '../middleware/validate.middleware'
import { chatSchema, type ChatBody } from './ai.types'

export const aiRouter = Router()

aiRouter.post('/chat', validate(chatSchema), async (req: Request, res: Response) => {
  const portfolio = await simulationService.getAllPositionsForAIContext(req.user!.userId)
  const result    = await aiService.chat((req.body as ChatBody).message, portfolio)
  res.json(result)
})

aiRouter.get('/summary', async (req: Request, res: Response) => {
  const portfolio = await simulationService.getAllPositionsForAIContext(req.user!.userId)
  const result    = await aiService.summary(portfolio)
  res.json(result)
})

aiRouter.get('/risk-analysis', async (req: Request, res: Response) => {
  const portfolio = await simulationService.getAllPositionsForAIContext(req.user!.userId)
  const result    = await aiService.riskAnalysis(portfolio)
  res.json(result)
})

aiRouter.get('/trends', async (req: Request, res: Response) => {
  const portfolio = await simulationService.getAllPositionsForAIContext(req.user!.userId)
  const result    = await aiService.trendAnalysis(portfolio)
  res.json(result)
})

aiRouter.get('/suggestions', async (req: Request, res: Response) => {
  const portfolio = await simulationService.getAllPositionsForAIContext(req.user!.userId)
  const result    = await aiService.investmentSuggestions(portfolio)
  res.json(result)
})
```

- [ ] **Step 3: Update ai.test.ts — add simulationService mock and fix beforeEach**

Replace the `vi.mock` block and `beforeEach` at the top of `src/test/ai.test.ts`:

```typescript
// Add this mock alongside the existing ai.service mock:
vi.mock('../simulation/simulation.service', () => ({
  simulationService: {
    getAllPositionsForAIContext: vi.fn(),
    getAccountForAIContext: vi.fn(),
    createAccount: vi.fn(),
    getAccounts: vi.fn(),
    getAccount: vi.fn(),
    deleteAccount: vi.fn(),
    executeTrade: vi.fn(),
    getOrders: vi.fn(),
  },
}))
```

Also add this import after the existing `aiService` import:

```typescript
import { simulationService } from '../simulation/simulation.service'
```

Replace the existing `beforeEach` block:

```typescript
beforeEach(() => {
  vi.mocked(simulationService.getAllPositionsForAIContext).mockResolvedValue({
    assets: [
      { symbol: 'AAPL', type: 'STOCK',  quantity: 10,  currentPrice: 175.5  },
      { symbol: 'BTC',  type: 'CRYPTO', quantity: 0.5, currentPrice: 45000  },
    ],
  })
})
```

Remove the old line:
```typescript
vi.mocked(prisma.asset.findMany).mockResolvedValue(mockAssets as any)
```

And remove the `mockAssets` constant and the `import { prisma }` line from ai.test.ts (prisma is no longer used there).

- [ ] **Step 4: Run the full test suite**

```bash
cd financial-ai-backend
npx vitest run
```

Expected: all tests across all test files PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.ts src/ai/ai.router.ts src/test/ai.test.ts
git commit -m "feat: wire simulationRouter into app, update AI router to use simulationService"
```

---

## Task 10: Delete Portfolio Module

**Files:**
- Delete: `src/portfolio/portfolio.router.ts`
- Delete: `src/portfolio/portfolio.service.ts`
- Delete: `src/portfolio/portfolio.types.ts`

- [ ] **Step 1: Delete portfolio files**

```bash
cd financial-ai-backend
rm src/portfolio/portfolio.router.ts
rm src/portfolio/portfolio.service.ts
rm src/portfolio/portfolio.types.ts
rmdir src/portfolio
```

- [ ] **Step 2: TypeScript compile check**

```bash
npx tsc --noEmit
```

Expected: no errors. If there are any remaining `import from '../portfolio/...'` references, fix them now.

- [ ] **Step 3: Run full test suite one final time**

```bash
npx vitest run
```

Expected: all tests PASS with no reference to portfolio module.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: remove portfolio module — trading simulator complete

- SimulationAccount/Position/Order replace Asset/Transaction
- executeTrade with atomic Prisma transaction and avgCost recalculation
- AI agents: simulationChat (Gemini), tradeCoach, riskManager, strategyGenerator (OpenAI)
- All /ai/* routes preserved via simulationService.getAllPositionsForAIContext
- Full test coverage: simulation.test.ts, simulation-ai.test.ts"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Simulation account with virtual balance (default $10,000) → Task 1 schema + Task 4 service
- ✅ Multiple named accounts per user → `@@unique([userId, name])` + createAccount/getAccounts
- ✅ Buy/sell endpoints → Task 5 executeTrade
- ✅ Update positions and balance atomically → `prisma.$transaction` in executeTrade
- ✅ Real-time market prices → `marketService.getPriceForAsset` called in executeTrade
- ✅ Order history tracking → Task 6 getOrders
- ✅ Portfolio module replaced → Task 10 deletion
- ✅ Simulator Chat (Gemini) → Task 7 simulationChat + Task 8 route test
- ✅ Trade Coach (OpenAI) → Task 7 tradeCoach + Task 8 route test
- ✅ Risk Manager (OpenAI) → Task 7 riskManager + Task 8 route test
- ✅ Strategy Generator (OpenAI) → Task 7 strategyGenerator + Task 8 route test
- ✅ All outputs structured JSON → response_format: json_object on all OpenAI calls
- ✅ Existing /ai/chat, /ai/summary, /ai/risk-analysis, /ai/trends, /ai/suggestions preserved → Task 9 ai.router.ts
- ✅ Modular architecture intact — simulation/ is self-contained, ai/ is self-contained
- ✅ avgCost recalculation formula documented and implemented
- ✅ All error codes: ACCOUNT_NOT_FOUND, ACCOUNT_NAME_TAKEN, INSUFFICIENT_FUNDS, INSUFFICIENT_POSITION, MARKET_PRICE_UNAVAILABLE
