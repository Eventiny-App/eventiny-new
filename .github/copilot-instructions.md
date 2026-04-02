# Eventiny — Project Guidelines

## Overview

Dance event management PWA. Four roles: **SuperAdmin**, **Organizer**, **Judge**, **Host**. Categories flow through phases: `IDLE → PRESELECTION → RANKING → BATTLES → COMPLETED` (versus) or `IDLE → PRESELECTION → RANKING → COMPLETED` (choreo). See [README.md](../README.md) for full product description.

## Stack

- **Frontend**: Nuxt 3 (v4 compat mode) + Vue 3 + TypeScript, Nuxt UI v3, Tailwind CSS v4
- **Backend**: Nitro server engine (file-based API routes), Zod validation
- **Database**: Prisma 6 — SQLite locally (`prisma/dev.db`), PostgreSQL/Neon in production
- **Auth**: JWT (jsonwebtoken + bcryptjs), httpOnly cookie, PIN-based login for judges/hosts
- **Real-time**: Short polling via `usePolling` composable (3s default)
- **PWA**: @vite-pwa/nuxt
- **Icons**: Lucide via `@iconify-json/lucide` (prefix `i-lucide-`)

## Build & Run

```bash
npm install                # also runs prisma generate via postinstall
npm run dev                # dev server on :3000
npm run db:push            # apply schema changes to DB
npm run db:seed            # seed superadmin (npx tsx prisma/seed.ts)
npm run db:studio          # Prisma Studio on :5555
```

Reset local DB: `rm prisma/dev.db && npm run db:push && npm run db:seed`

## Architecture

```
app/                    # Frontend — Nuxt app directory
  pages/                # File-based routing (admin/, organizer/, host/, judge/)
  composables/          # useAuth, usePolling, useOnlineStatus
  assets/css/main.css   # Global styles
server/
  api/                  # File-based API routes (verb suffix: .get.ts, .post.ts, etc.)
  utils/                # auth.ts, prisma.ts, sanitize.ts, bracket.ts
prisma/
  schema.prisma         # 16 models, all IDs are CUIDs
  seed.ts               # SuperAdmin seeder
```

## API Route Conventions

- **Auto-imports**: Nitro auto-imports server utils — `prisma`, `requireAuth`, `validateName`, `sanitizeName`, `createError`, `readValidatedBody`, `getRouterParam`, `getCookie`, `getHeader` are all available without explicit imports. Only import `z` from `'zod'` and external libraries explicitly.
- **Auth**: Call `requireAuth(event, ...roles)` at the top of every handler. Returns `JwtPayload` with `userId`, `judgeId`, `hostId`, `eventId`, `role`.
- **Validation**: Use Zod schemas with `readValidatedBody(event, schema.parse)`. Define the schema at the top of the file.
- **Name inputs**: Always run through `validateName()` from `server/utils/sanitize.ts` — it normalizes Unicode, trims whitespace, and enforces length.
- **Errors**: Throw with `createError({ statusCode, statusMessage })`.
- **Prisma**: Use the auto-imported `prisma` singleton. Use `select` or `include` explicitly — never return raw models without field selection.
- **Cascade deletes**: All child relations use `onDelete: Cascade` in the Prisma schema.
- **Router params**: Extract with `getRouterParam(event, 'paramName')`.
- **Return shape**: Return the Prisma result directly (no wrapper object).
- **No tests**: The project has no test framework. Do not attempt to run or create tests unless asked.

## Frontend Conventions

- **Components**: Nuxt UI v3 components (`UButton`, `UCard`, `UInput`, `UModal`, `UTable`, etc.). Dark theme by default (`bg-gray-950 text-white`).
- **Data fetching**: Use `$fetch` for mutations and one-off requests. Use `usePolling<T>(url)` for live data that auto-refreshes.
- **Auth state**: `useAuth()` composable — provides `isLoggedIn`, `isAdmin`, `isOrganizer`, `isJudge`, `isHost`, `login()`, `loginWithPin()`, `logout()`, `fetchMe()`.
- **Navigation**: `navigateTo()` for programmatic routing. Nuxt file-based routing for pages.
- **Icons**: `icon="i-lucide-icon-name"` on Nuxt UI components.
- **Styling**: Tailwind utility classes. No scoped CSS. Consistent spacing with `space-y-*` and `gap-*`.

## Prisma Conventions

- All IDs: `@id @default(cuid())`
- Timestamps: `createdAt DateTime @default(now())` + `updatedAt DateTime @updatedAt`
- M:N relations use explicit join models (e.g., `ParticipantCategory`, `JudgeCategory`) — not implicit `@relation`
- Uniqueness: `@@unique` composites on join tables (e.g., `[judgeId, categoryId, participantId]`)
- PINs: `@@unique([eventId, accessPin])` ensures unique PINs within an event across judges and hosts separately
- **Schema provider**: `schema.prisma` uses `postgresql` as the datasource provider. Locally, set `DATABASE_URL` to a file-based SQLite URL or a local PostgreSQL instance; in production, Neon PostgreSQL.
- **Category dual state**: `Category.status` stores the phase (idle/preselection/ranking/battles/completed), and `CategoryState` model stores live state (current participant, current matchup, timer). Both must be updated during phase transitions.

## Security

- All API routes require JWT auth — no public endpoints except login/pin
- Organizer ownership is enforced server-side (`organizerId` checked on every event query)
- Event IDs are CUIDs (unguessable room codes), not sequential
- Sanitize all user-facing string inputs via `validateName()`
