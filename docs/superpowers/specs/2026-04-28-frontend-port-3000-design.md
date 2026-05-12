# Frontend Port 3000 — Design Spec

**Date:** 2026-04-28
**Status:** Approved
**Scope:** Standardize `financial-ai-frontend` local runtime to `localhost:3000`

---

## Overview

The frontend had been configured to run locally on `localhost:3002`, which diverged from the default Next.js local expectation and from typical local-development assumptions.

This change standardizes the frontend runtime to `localhost:3000` for both local development and local production-style start commands.

Result:

1. `npm run dev` serves on `http://localhost:3000`
2. `npm start` serves on `http://localhost:3000`
3. Local environment docs reflect the new default

---

## Approach

**Option A — Update script-level port configuration only.**

- Keep Next.js defaults and app code unchanged
- Update the package scripts that currently pin the alternate port
- Update the frontend environment example comment so contributors see the right local URL

No routing, proxying, or API URL changes are required.

Backend CORS must still allow the new origin, even if a local `.env` file previously pinned the frontend to `3002`.

---

## Section 1: Script Changes

### Development server

Update the `dev` script from:

```json
"dev": "next dev --port 3002"
```

to:

```json
"dev": "next dev --port 3000"
```

### Production-style local server

Pin the `start` script to `3000` as well so local smoke testing uses the same port as development:

```json
"start": "next start --port 3000"
```

---

## Section 2: Documentation Update

Update local environment guidance so the repo no longer claims the frontend runs on `3002`.

This affects:

- the frontend example env comment
- the backend example env value for `FRONTEND_URL`
- the checked-in backend local env used by this workspace

The API URL remains unchanged and continues to target backend port `8080`.

---

## Section 3: Backend CORS Compatibility

The backend must accept requests from `http://localhost:3000` after the port migration.

Implementation rule:

- treat `localhost:3000` as the new primary frontend origin
- continue to tolerate `localhost:3002` during the transition so stale browser sessions and older local processes do not hard-fail
- allow a comma-separated `FRONTEND_URL` env override without losing the built-in local defaults

---

## Files Changed

| File | Change |
|------|--------|
| `financial-ai-frontend/package.json` | Change `dev` and `start` scripts to port `3000` |
| `financial-ai-frontend/.env.local.example` | Update the local frontend port comment |
| `financial-ai-backend/src/app.ts` | Allow `localhost:3000` in CORS while keeping `localhost:3002` compatible |
| `financial-ai-backend/.env` | Change local `FRONTEND_URL` to `http://localhost:3000` |
| `financial-ai-backend/.env.example` | Change example `FRONTEND_URL` to `http://localhost:3000` |

---

## Non-Goals

- No backend port changes
- No API base-path changes
- No deployment configuration changes
- No rewrite/proxy changes

---

## Testing

- Run `npm run build`
- Start the frontend locally on `localhost:3000`
- Verify `/` and `/login` both respond successfully on the new port
- Send a backend CORS preflight from `http://localhost:3000` and verify `Access-Control-Allow-Origin: http://localhost:3000`