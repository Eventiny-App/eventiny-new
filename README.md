# Eventiny

Firebase-first implementation scaffold for a dance battle management platform.

## What is implemented now

- Monorepo structure with clear boundaries for migration safety.
- Shared domain package for battle lifecycle and ranking tie detection.
- Application layer with use cases for organizer access validation and category start flow.
- Firebase adapter package implementing repositories against Firestore.
- Web app scaffold with responsive foundation and a domain-logic demo screen.
- Documentation for free-tier operation and next implementation slices.

## Workspace structure

```text
apps/web                    # Web app (PWA-ready foundation)
packages/domain             # Pure domain models and rules
packages/application        # Use cases and ports
packages/adapters-firebase  # Firebase implementation of ports
docs                        # Architecture and rollout docs
```

## Why this structure

- You can stay on Firebase free tier initially.
- Core business logic does not depend on Firebase.
- Future hosting migration only requires replacing adapter package and data mapping.

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Copy environment template:

```bash
cp apps/web/.env.example apps/web/.env
```

3. Fill Firebase values in `apps/web/.env`.

4. Run the app:

```bash
npm run dev
```

## Free-tier guardrails

- Keep MVP online-first and lightweight.
- Disable expensive features until needed (heavy exports, high-frequency background jobs).
- Monitor read/write usage weekly.

See:

- `docs/architecture-firebase.md`
- `docs/free-tier-guardrails.md`
- `docs/next-implementation-slices.md`