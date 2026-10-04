# SeatSwap — Full-Stack Subscription Sharing Marketplace

SeatSwap connects people who pay for team/family subscriptions (Canva, Adobe CC, Figma, Microsoft 365, Notion, Spotify, YouTube Premium) with members looking to take a seat and split the monthly cost.

This repository includes the complete frontend UI, Node.js + Express backend, and a PostgreSQL database with atomic concurrency locking for seat reservations.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v26)
- **PostgreSQL**: v14+ (running locally on port 5432)

### 2. Configure Environment
Copy `.env.example` to `.env` and fill it in. `.env` is git-ignored; never commit it.

- `NODE_ENV=development` enables local conveniences. Any other value (or unset) is strict.
- `JWT_SECRET` is **required** outside development (32+ random characters). In development an unset value falls back to a development-only secret with a warning.
- `CORS_ORIGINS` is a comma-separated allow-list. Empty means same-origin only (plus localhost in development).
- `DEMO_MODE=true` and `DEV_TOOLS=true` switch on sample-account sign-in and the in-page developer panel. They are ignored unless `NODE_ENV=development`.

### 3. Initialize & Seed Database
Ensure PostgreSQL is running and seed the database with initial users, services, groups, and seats:
```bash
npm run seed
```

### 4. Start the Application
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## 🛠️ Tech Stack & Architecture

- **Backend**: Node.js & Express 5
- **Database**: PostgreSQL (relational schema with ACID transactions)
- **Authentication**: JWT tokens with bcrypt password hashing
- **Real-Time Updates**: Server-Sent Events (SSE) broadcasting live seat reservations and new group creations across all open browser tabs
- **Frontend**: Vanilla HTML5, CSS3 with dark/light themes, 3D Canvas projection, interactive SVG seat rings, and reactive modals

---

## 🛡️ Atomic Seat Locking (Zero Double-Booking)

When a member clicks **"Join selected seat"**:
```sql
BEGIN;
SELECT id, status, member_id FROM seats 
WHERE group_id = $1 AND seat_number = $2 
FOR UPDATE;

-- Validates that the seat is strictly 'open'
-- If already taken -> ROLLBACK & 409 Conflict
-- If open -> Marks seat 'rsv' (reserved, payment pending), assigns member,
--             records a membership with status 'reserved' / payment_status 'pending'
COMMIT;
```
This guarantees that concurrent requests to the same seat will never result in double booking.

---

## 👥 Sample accounts (development only)

`npm run seed` creates sample accounts (password `password123`) for local development, for example `aarav@example.com` (holds 3 seats) and `rahul@example.com` (hosts a Canva group). Seeding refuses to run unless `NODE_ENV=development`. None of the sample accounts are verified.

With `DEMO_MODE=true` (development only) the login dialog also offers passwordless sign-in as five of them. Real sign-up creates a normal, unverified account; there is no way to declare yourself a verified host.

---

## 📡 REST API Reference

### Auth
- `POST /api/auth/register` — Create a normal, unverified account
- `POST /api/auth/login` — Authenticate and receive JWT
- `GET /api/auth/me` — Get profile, active memberships, and hosted groups
- `GET /api/auth/demo-users`, `POST /api/auth/switch-demo` — sample-account sign-in; 404 unless `DEMO_MODE=true` in development

### Services
- `GET /api/services` — List supported subscription providers

### Groups & Seats
- `GET /api/groups` — Search & filter groups (`q`, `svc`, `maxPrice`, `openOnly`, `sort`)
- `GET /api/groups/:id` — Group details with real-time seat status array
- `POST /api/groups` — Host a new subscription plan (creates group + seats)
- `POST /api/groups/:id/seats/:seatNum/join` — Reserve a seat. Seat `rsv`, membership `reserved`, payment `pending`. Nothing is charged and nothing becomes `act`/`active` until real payments exist. Other users only see the seat as taken.
- `POST /api/groups/:id/seats/:seatNum/leave` — Leave a held seat

### Dashboard
- `GET /api/dashboard` — Signed-in user's own seats, spend and notifications (401 when logged out)
- `GET /api/events/sse` — Real-time Server-Sent Events stream
- `GET /api/health` — Health check (minimal output outside development)
- `GET /api/config` — Non-secret flags the frontend uses (`demoMode`, `devTools`)


---

## 🎨 Design system (Phase 1)

All shared styling lives in the `<style>` block of `public/index.html` and is driven by CSS custom properties on `:root` (light, default) and `:root[data-theme="dark"]`.

- **Colour**: `--bg --panel --panel2 --line --line2 --text --muted --brand --open --act --member --danger`, plus `--*-ink` variants for text on tinted badges. Never hard-code colours in components.
- **Spacing**: 4px scale `--s1 … --s16`. **Radii**: `--r-ctl` (10) for buttons/inputs, `--r-card` (16), `--r-modal` (20); `--r-pill` only for badges/tags.
- **Motion**: `--dur-fast/base/ctl/pop/sheet` (150–340ms) with `--ease`; `prefers-reduced-motion` disables decorative and looping animation.
- **Primitives**: `.btn` (+ `.primary`, `.ghost`, `.danger`, `.sm`, `.lg`), form controls (inputs, select, textarea share one base; `.toggle`, `aria-invalid`, `.is-ok`), `.card`, `.panel`, `.badge` (+ `.ok .pend .warn .err .muted`), `.modal-scrim/.modal-box`, `.drawer`.
- The green `.badge.ok` must only be rendered from a real completed state. No verification badge exists in the UI today.
