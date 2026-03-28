# Eventiny

A Progressive Web App for managing dance battle events — from registration through preselections to bracket battles, all from any smartphone, tablet, or laptop.

---

## How It Works

Eventiny has **four roles**, each with a distinct purpose:

### 1. Admin (superadmin)
The admin is the owner of the platform. They:
- Create **organizer accounts** (email + password) with optional access expiry dates.
- Can reset organizer passwords if forgotten.
- See all events across all organizers for support purposes.

### 2. Organizer
An organizer manages one or more events. After logging in with their email/password, they:
- **Create an event** with a name and date range.
- **Set up categories** — each category is an independent competition (e.g., "House", "Breaking Top 16", "Hip Hop Crew Choreo"). Categories can be:
  - **Battle** — 1v1 elimination bracket after preselections.
  - **Choreographic** — crews/soloists scored on multiple themes (e.g., Musicality, Technique, Creativity).
- **Register participants** (dancers/crews) and assign them to one or more categories.
- **Create judges** with PINs, assign them to categories with optional weight (e.g., a head judge might count 1.5×).
- **Create hosts** with PINs, assign them to manage specific categories.

The organizer then shares two things with staff:
- The **Event ID** (shown on the event page).
- Each judge's/host's **PIN** (set during creation).

### 3. Host (MC)
The host runs the show from their phone. On the Host Panel they:
- **Select a category** to run.
- **Start preselections** — participants are shown one at a time in randomized order.
- **Navigate** through participants ("Next" / "Previous") while judges score in real-time.
- **Finish preselections** — the app computes rankings.
- **Review ranking** — see scores, detect ties at the bracket cutoff.
- **Generate the battle bracket** — the app seeds matchups automatically (1 vs 16, 2 vs 15, etc.).
- **Run battles** — activate each matchup, and either:
  - **Hands mode**: Judges raise hands, host picks the winner manually.
  - **App mode**: Each judge votes on their device, the app computes the result.
- **Complete the category** when the bracket is finished.

### 4. Judge
Judges vote from their phone. On the Judge Panel they:
- See the **current performer** (updated in real-time via polling).
- **Score 0–10** (with decimals) using a slider for battle preselections.
- **Score per theme** for choreographic categories (one slider per theme).
- **Vote on battles** (in app mode) by tapping the winner's name.
- Can update their vote until the host moves on.

### The Flow for a Battle Category

```
IDLE → PRESELECTION → RANKING → BATTLES → COMPLETED
```

1. **Idle**: Category exists, participants registered, waiting to start.
2. **Preselection**: Host walks through each participant. Judges score 0–10. Scores are averaged (respecting judge weights).
3. **Ranking**: Preselection results are computed. The top N (bracket size) advance. Ties at the cutoff are flagged for the host to resolve manually.
4. **Battles**: Bracket is generated with standard seeding. Single or double elimination. Host activates one matchup at a time, winner advances automatically.
5. **Completed**: Final results are set.

### The Flow for a Choreographic Category

```
IDLE → PRESELECTION → RANKING → COMPLETED
```

Same as above but without a battle phase. Each crew/soloist is scored on multiple themes. Final ranking is the weighted average across all themes and judges.

### Single vs Double Elimination

**Single elimination** — lose once and you're out.

Example with 4 dancers (seeds 1–4):
```
Round 1:        Semis:        Final:
Seed 1 ─┐
         ├─ Winner A ─┐
Seed 4 ─┘              │
                        ├─ Champion
Seed 2 ─┐              │
         ├─ Winner B ─┘
Seed 3 ─┘
```

**Double elimination** — you get a second chance through the losers bracket.

Example with 4 dancers:
```
WINNERS BRACKET:
Round 1:        Finals:
Seed 1 ─┐
         ├─ W1 ──┐
Seed 4 ─┘         │
                   ├─ Winners Final Champion
Seed 2 ─┐         │
         ├─ W2 ──┘
Seed 3 ─┘

LOSERS BRACKET (second chance):
Losers of Round 1:      Losers Final:
L1 (lost to Seed 1) ─┐
                       ├─ Losers Champion
L2 (lost to Seed 2) ─┘

GRAND FINAL:
Winners Champion vs Losers Champion
(Losers Champion must win twice to take the title)
```

Double elimination is popular in dance battles because a single bad round shouldn't end someone's run — it gives the stronger dancer a chance to come back.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Nuxt 3, Vue 3, Nuxt UI v3, Tailwind CSS |
| Backend | Nitro (Nuxt's server engine), TypeScript |
| Database | SQLite (local dev), PostgreSQL via Neon (production) |
| Auth | JWT + bcrypt, httpOnly cookies |
| Real-time | Short polling (2.5s interval) |
| Validation | Zod schemas on every API input |
| PWA | @vite-pwa/nuxt |
| Hosting | Vercel + Neon (both free tier) |

---

## Running Locally

### Prerequisites

- **Node.js** 18+ (recommended: 20+)
- **npm** (comes with Node)

### Setup

```bash
# Clone the repository
git clone https://github.com/Eventiny-App/eventiny-new.git
cd eventiny-new

# Install dependencies
npm install

# Set environment variables (a .env file is included for development)
# Edit .env if you want to change the superadmin email/password:
#   SUPERADMIN_EMAIL="your@email.com"
#   SUPERADMIN_PASSWORD="yourpassword"

# Create the local database and seed the superadmin account
npx prisma db push
npm run db:seed

# Start the dev server
npm run dev
```

The app will be available at **http://localhost:3000**.

### Default Superadmin Credentials

Check your `.env` file:
```
SUPERADMIN_EMAIL=nikten96@gmail.com
SUPERADMIN_PASSWORD=changeme
```

After login, the admin dashboard lets you create organizer accounts.

---

## Database Management

### View the database with Prisma Studio

```bash
npx prisma studio
```

Opens a visual database browser at http://localhost:5555. You can view, edit, and delete any record directly.

### Reset the database completely

This deletes ALL data and re-creates the schema and superadmin:

```bash
rm prisma/dev.db
npx prisma db push
npm run db:seed
```

### Reset just the seed (keep schema, wipe data)

```bash
rm prisma/dev.db
npx prisma db push
npm run db:seed
```

(Since SQLite stores everything in `dev.db`, both approaches are the same.)

### Apply schema changes after editing `prisma/schema.prisma`

```bash
npx prisma db push
```

> **Note**: If you changed the schema in a way that conflicts with existing data, you may need to reset the database first.

### Inspect the database directly with SQLite CLI

```bash
sqlite3 prisma/dev.db
```

Useful commands:
```sql
.tables                          -- list all tables
.schema Event                    -- show a table's structure
SELECT * FROM Event;             -- query data
SELECT * FROM User;              -- see all users (admin + organizers)
SELECT * FROM Judge WHERE eventId = 'your-event-id';
UPDATE User SET enabled = 1 WHERE email = 'someone@example.com';
.quit
```

---

## Project Structure

```
eventiny-new/
├── app/                      # Frontend (Nuxt app directory)
│   ├── composables/          # Shared Vue composables (useAuth, usePolling)
│   └── pages/                # File-based routing
│       ├── index.vue         # Login page
│       ├── admin/            # Admin dashboard
│       ├── organizer/        # Organizer dashboard + event management
│       ├── host/             # Host control panel
│       └── judge/            # Judge voting interface
├── server/                   # Backend (Nitro server)
│   ├── api/                  # API route handlers (file-based)
│   │   ├── auth/             # Login, logout, PIN auth, session check
│   │   ├── admin/            # Admin: manage organizers, view all events
│   │   └── events/           # Event CRUD + all nested resources
│   └── utils/                # Shared server utilities
│       ├── auth.ts           # JWT sign/verify, requireAuth middleware
│       ├── prisma.ts         # Prisma client singleton
│       ├── sanitize.ts       # Name validation & Unicode normalization
│       └── bracket.ts        # Bracket generation (single & double elimination)
├── prisma/
│   ├── schema.prisma         # Database schema (16 models)
│   └── seed.ts               # Superadmin seeder
├── .env                      # Environment variables (local dev)
├── nuxt.config.ts            # Nuxt configuration
└── package.json
```

---

## Security Notes

- **Event IDs are random CUIDs** (e.g., `cmnaenhiz00021a1q0w4ur7hp`). They are unguessable but not secret — anyone with the ID can attempt to log in as judge/host if they also know a valid PIN. This is by design: the Event ID acts as a "room code" shared with event staff.
- **All API endpoints require authentication**. Even knowing an event ID, you cannot access any data without a valid JWT token.
- **Organizer ownership is enforced server-side**. An organizer can only see and modify their own events. The admin can see all events.
- **PINs are unique per event** across both judges and hosts, preventing login confusion.
- **Names are unique per event** for participants, judges, and hosts separately.

---

## Troubleshooting

### "Page not found" on API routes
Restart the dev server (`Ctrl+C` then `npm run dev`). Nitro sometimes needs a restart after file structure changes.

### Port already in use
```bash
# Find and kill the process on port 3000
lsof -i :3000 | grep LISTEN
kill -9 <PID>
```

### Organizer forgot password
The admin can reset it: Admin Dashboard → click "Edit" on the organizer → set a new password.

### Database is corrupted or in a bad state
```bash
rm prisma/dev.db && npx prisma db push && npm run db:seed
```

### Prisma schema out of sync
```bash
npx prisma generate   # Regenerate the client
npx prisma db push    # Push schema to database
```
