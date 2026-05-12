# Env And Secret Hygiene

## Purpose

The workspace contains more than one runnable application.
Environment variables must live at the app boundary that actually loads them, and live provider keys must never be stored in tracked files or documentation.

## Runtime Boundaries

### Backend

- Runtime root: `financial-ai-backend`
- Env file: `financial-ai-backend/.env`
- Template: `financial-ai-backend/.env.example`
- Required secrets:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `GOOGLE_GEMINI_API_KEY`
  - `OPENAI_API_KEY`
- Optional fallback provider keys:
  - `ALPACA_KEY`
  - `ALPACA_SECRET`

### Frontend

- Runtime root: `financial-ai-frontend`
- Env file: `financial-ai-frontend/.env.local`
- Template: `financial-ai-frontend/.env.example`
- Public config:
  - `NEXT_PUBLIC_API_URL`

### Workspace Root

- The workspace root is not the canonical runtime boundary for either app.
- A root `.env.local` should not be used as the primary place for live provider keys.
- If a root env file exists for local convenience, it must remain ignored and must not be treated as the source of truth.

## Immediate Operational Actions

1. Rotate any live OpenAI or Gemini keys that were pasted into local files, chat attachments, screenshots, or shell history.
2. Recreate local env files from the example files at the backend and frontend boundaries.
3. Keep secrets out of docs, tests, and committed fixture files.

## Verification

- Backend commands run from `financial-ai-backend`
- Frontend commands run from `financial-ai-frontend`
- Example env files must contain placeholders only, never real tokens