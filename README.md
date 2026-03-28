# Eventiny

Firebase-first implementation scaffold for a dance battle management platform.

## What is implemented now

- Monorepo structure with clear boundaries for migration safety.
- Shared domain package for battle lifecycle and ranking tie detection.
- Application layer with use cases for organizer access validation and category start flow.
- Firebase adapter package implementing repositories against Firestore.
- Local simulation app with separate login pages and isolated dashboards for creator and organizer.
- Creator flow to generate temporary organizer credentials and revoke them.
- Organizer flow to manage categories, registrations, run order start, and preselection simulation.
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

2. Run the app:

```bash
npm run dev
```

3. Open the local URL shown by Vite.

4. Login as creator (local-dev credentials):

```bash
username: creator
password: creator123
```

5. In creator dashboard, create organizer access and note generated username/password.

6. Logout and login as organizer using generated credentials.

7. Run a local event simulation:
- create categories
- register participants
- start category (random run order)
- run preselection simulation and inspect tie-at-cutoff result

## Notes on local mode

- Local simulation persists in browser local storage.
- Creator and organizer dashboards are separated by login session.
- Organizer cannot access creator dashboard unless creator credentials are used.
- Firebase environment values are not required for local simulation at this stage.

## Free-tier guardrails

- Keep MVP online-first and lightweight.
- Disable expensive features until needed (heavy exports, high-frequency background jobs).
- Monitor read/write usage weekly.

See:

- `docs/architecture-firebase.md`
- `docs/free-tier-guardrails.md`
- `docs/next-implementation-slices.md`