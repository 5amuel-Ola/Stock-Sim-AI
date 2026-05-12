# Financial AI Backend — Design Spec
**Date:** 2026-04-13
**Stack:** Node.js / TypeScript / Express / PostgreSQL / Prisma
**Status:** Approved

---

## Overview

A Node.js + TypeScript REST API backend for a personal finance portfolio tracker. Users authenticate, input their stock and crypto holdings, fetch live market prices, record transactions, and get AI-powered portfolio analysis via Google Gemini AI.

**External APIs:**
- Gemini Exchange — real-time crypto market data
- Alpaca — real-time stock market data
- Google Gemini AI — portfolio chat + automated summaries

---

## Architecture

Domain-driven modular structure. Each domain (`auth`, `portfolio`, `market`, `ai`) owns its router, service, and types. Shared infrastructure lives in `lib/`. All domains are mounted on the Express app in `app.ts`.

### Directory Structure

```
financial-ai-backend/
  src/
    auth/
      auth.router.ts         # POST /auth/register, /login, /refresh, /logout
      auth.service.ts        # bcrypt hashing, JWT issuance, refresh token logic
      auth.types.ts
    portfolio/
      portfolio.router.ts    # GET/POST/DELETE /portfolio/assets, /transactions
      portfolio.service.ts   # CRUD against Prisma, price enrichment
      portfolio.types.ts
    market/
      market.router.ts       # GET /market/crypto/:symbol, /stock/:symbol, /prices
      market.service.ts      # orchestrates Gemini Exchange + Alpaca clients
      gemini.client.ts       # Gemini Exchange REST calls
      alpaca.client.ts       # Alpaca market data REST calls
      market.types.ts
    ai/
      ai.router.ts           # POST /ai/chat, GET /ai/summary
      ai.service.ts          # Google Gemini AI SDK calls
      ai.types.ts
    lib/
      prisma.ts              # singleton PrismaClient
      logger.ts              # Winston instance
      errors.ts              # AppError class + HTTP status codes
    middleware/
      auth.middleware.ts     # JWT verification, attaches req.user
      validate.middleware.ts # Zod schema runner
      error.middleware.ts    # global error handler
    app.ts                   # Express app setup (middleware, routers)
    server.ts                # HTTP listen + graceful shutdown
    test/
      setup.ts               # vitest global setup
  prisma/
    schema.prisma
  .env.example
```

---

## Database Schema

PostgreSQL via Prisma ORM.

```prisma
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

**Key decisions:**
- `Decimal(18,8)` for quantity and price — handles crypto precision without floating-point errors
- `@@unique([userId, symbol])` on Asset — one aggregate position per symbol per user; transactions are the full history
- `RefreshToken` stored in DB so logout actually invalidates tokens; tokens are bcrypt-hashed before storage
- `onDelete: Cascade` on all user-owned data

---

## API Endpoints

Base path: `/api/v1`. Protected routes require `Authorization: Bearer <accessToken>`.

### Auth (public)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/auth/register` | `{ email, password }` | `{ user }` |
| POST | `/auth/login` | `{ email, password }` | `{ accessToken, refreshToken }` |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken }` |
| POST | `/auth/logout` | `{ refreshToken }` | 204 No Content |

### Portfolio (protected)

| Method | Path | Body / Query | Description |
|--------|------|------|-------------|
| GET | `/portfolio` | — | User's assets with live prices injected |
| POST | `/portfolio/assets` | `{ symbol, type, quantity }` | Upsert position |
| DELETE | `/portfolio/assets/:id` | — | Remove asset and its transactions |
| POST | `/portfolio/transactions` | `{ assetId, type, quantity, price }` | Record a buy/sell |
| GET | `/portfolio/transactions` | `?symbol=&limit=&offset=` | Transaction history |

### Market (protected)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/market/crypto/:symbol` | Gemini Exchange spot price |
| GET | `/market/stock/:symbol` | Alpaca latest quote |
| GET | `/market/prices` | Batch prices for all user's current assets |

Market responses cached in-process for 30 seconds to protect free-tier API quotas.

### AI (protected)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/ai/chat` | `{ message }` | Gemini AI answer with portfolio context injected |
| GET | `/ai/summary` | — | Auto-generated portfolio insight paragraph |

---

## Token Strategy

- **Access token:** 15-minute JWT, signed with `JWT_SECRET`, stateless
- **Refresh token:** 7-day opaque token, bcrypt-hashed before storage in `RefreshToken` table
- Logout deletes the refresh token row — invalidation is real, not just client-side

---

## External API Clients

### Gemini Exchange (`gemini.client.ts`)
- Base URL: `https://api.gemini.com/v1`
- Public endpoint: `GET /pubticker/:symbol` — no auth required for spot prices
- Symbol format: `BTCUSD`, `ETHUSD`, etc.

### Alpaca (`alpaca.client.ts`)
- Base URL: `https://data.alpaca.markets/v2`
- Auth: `APCA-API-KEY-ID` + `APCA-API-SECRET-KEY` headers
- Endpoint: `GET /stocks/{symbol}/quotes/latest`

### Google Gemini AI (`ai.service.ts`)
- Uses `@google/generative-ai` SDK
- Model: `gemini-1.5-flash`
- Portfolio context (holdings + current prices) serialized and prepended to every prompt
- Chat endpoint is stateless — full context passed per request
- Summary endpoint uses a fixed prompt template requesting a concise insight paragraph

---

## Error Handling

```ts
class AppError extends Error {
  constructor(message: string, public statusCode: number, public code?: string) {
    super(message)
  }
}
```

- `express-async-errors` patches Express so async throws reach error middleware without try/catch in routes
- Global error middleware logs via Winston then returns:
  - `4xx`: `{ error: message }` — client-safe details included
  - `5xx`: `{ error: 'Internal server error' }` in production — no stack traces leaked
- Upstream API failures wrapped as `AppError` with 502 status

| Failure | HTTP |
|---------|------|
| Zod validation | 400 |
| Bad credentials | 401 |
| Invalid / expired JWT | 401 |
| Forbidden resource | 403 |
| Not found | 404 |
| Upstream API failure | 502 |
| Unhandled | 500 |

---

## Logging (Winston)

- **Dev:** colorized console
- **Prod-ready:** structured JSON file transport
- Every request: method, path, status, duration
- External API calls: symbol + duration at `debug` level — API keys never logged
- Errors: full stack trace at `error` level
- No PII in logs

---

## Security

| Layer | Mechanism |
|-------|-----------|
| HTTP headers | `helmet` on all responses |
| Rate limiting | 20 req/15 min on `/auth/*`, 100 req/15 min elsewhere |
| Input validation | Zod on all request bodies before any DB/API call |
| Password storage | bcrypt, cost factor 12 |
| Refresh token storage | bcrypt-hashed in DB |
| API keys | `dotenv`, validated at startup — server exits if any key is missing |
| JWT secret | Minimum 32 chars enforced at startup |
| IDOR prevention | All asset/transaction routes verify `userId` ownership before DB ops |
| SQL injection | Prisma ORM — no raw SQL |

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/financial_ai

# Auth
JWT_SECRET=                   # min 32 chars
JWT_REFRESH_SECRET=           # min 32 chars, different from JWT_SECRET

# Gemini Exchange (crypto market data)
GEMINI_API_KEY=
GEMINI_API_SECRET=

# Alpaca (stock market data)
ALPACA_KEY=
ALPACA_SECRET=

# Google Gemini AI
GOOGLE_GEMINI_API_KEY=

# Server
PORT=3001
NODE_ENV=development
```

---

## Out of Scope

- WebSocket / real-time price streaming
- Background job queue for scheduled AI summaries
- Multi-currency / FX conversion
- Frontend / client application
