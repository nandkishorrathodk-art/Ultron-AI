---
name: testing-ultron-ai
description: Test Ultron-AI end-to-end — login, settings, chat, download page, security guards. Use when verifying UI or API changes.
---

## Prerequisites

- Node.js 20+ (repo tested on v22.12.0)
- pnpm 10.33.2 (repo-pinned via `packageManager` field)
- Dev server: `npx next dev --turbopack -p 3000`

## Devin Secrets Needed

- `NVIDIA_API_KEY` — LLM provider key (set as `LLM_API_KEY` in `.env.local`)
- `E2B_API_KEY` — Cloud sandbox execution
- `JINA_API_KEY` — Web content retrieval (optional)

## Environment Setup

1. Install dependencies: `pnpm install`
2. Copy `.env.example` to `.env.local` and fill in secrets
3. Critical `.env.local` values:
   - `JWT_SECRET` and `SESSION_SECRET` must match (or set only `JWT_SECRET`)
   - `ADMIN_PASSWORD_HASH` — bcrypt hash with `\$` escaping (dotenv-expand treats `$` as variable expansion)
   - Default admin: `admin@ultron.ai` / `admin123`
4. Start dev server: `npx next dev --turbopack -p 3000`

## Login Flow

- Navigate to `/login`, enter `admin@ultron.ai` / `admin123`
- On success: redirects to `/` (console page with sidebar)
- If login bounces to `/landing`: JWT secret mismatch between `session.ts` and `proxy.ts`

## Testing Settings API

- `POST /api/settings` requires admin session cookie
- Without cookie: returns 403 "Admin access required"
- With admin cookie: returns 200
- Settings page at `/settings` allows changing LLM provider URL, model, API key, and E2B key at runtime

## Testing LLM Chat Errors

**Important gotcha:** `streamText()` from the `ai` SDK is lazy. API auth errors (401 Unauthorized) propagate through the SSE stream body, NOT via synchronous throw. A try/catch around `streamText()` will never catch upstream auth failures.

To test error message rewriting:
1. Go to Settings, set API Key to `invalid-key-12345`, save
2. Go to console, send any message (e.g. "scan example.com")
3. Expected: "AI provider authentication failed — check your API key in Settings or .env.local"
4. If broken: raw "Unauthorized" or "User not found" message appears

The fix uses a `TransformStream` wrapper on `response.body` to intercept and rewrite error chunks in real-time.

## Testing Download Page

- Navigate to `/download`
- Without Convex backend, the error boundary catches the missing provider error
- `FallbackHeader` renders without `useAuth()` dependency
- Expected: Page shows header + download cards for macOS, Windows, Linux
- If broken: white screen crash ("Could not find ConvexProviderWithAuth")

## Testing Command Injection Guard

- In `src/app/api/chat/route.ts`, the `install_tool` execute function has a `shellUnsafe` regex
- Pattern: `/[;&|\`$(){}[\]<>!#\n\r\\\'"]/`
- Must test both `src` and `tool_name` parameters before shell command construction

## Common Issues

- **bcrypt hash escaping**: In `.env.local`, bcrypt `$` chars must be escaped as `\$` due to dotenv-expand
- **Session/JWT mismatch**: `session.ts` and `proxy.ts` must use same secret precedence chain
- **Convex not available**: Download page and some features depend on Convex — error boundaries handle graceful fallback
- **NVIDIA API returns 401**: Check that the API key starts with `nvapi-` and is valid
