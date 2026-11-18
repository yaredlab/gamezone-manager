# GameZone Manager V2 — Backend

Express.js REST API + Prisma ORM + PostgreSQL 15+

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| PostgreSQL | 15+ |
| npm / pnpm | any recent |

### 1. Create PostgreSQL database

```sql
-- Run as a PostgreSQL superuser (psql -U postgres)
CREATE USER gamezone_user WITH PASSWORD 'your_password';
CREATE DATABASE gamezone_v2 OWNER gamezone_user;
GRANT ALL PRIVILEGES ON DATABASE gamezone_v2 TO gamezone_user;
```

### 2. Configure environment

```bash
cd backend/
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, CORS_ORIGINS
```

Or run the interactive wizard:

```bash
node scripts/setup.js
```

### 3. Install dependencies

```bash
cd backend/
npm install
```

### 4. Run database migrations

```bash
npm run db:migrate
```

This creates all tables, enums, indexes, and views in your PostgreSQL database.

### 5. Seed default data

```bash
npm run db:seed
```

Seeds:
- 7 default consoles (PS4-01…PS4-04, PS5-01…PS5-03)
- Default pricing (PS4=25 ETB, PS5=30 ETB, Mission=50 ETB/30 min)
- Admin account (username: `admin`, PIN: `1234` — **change immediately**)
- Worker account (username: `worker1`, PIN: `0000`)

### 6. Start the server

```bash
npm run dev       # development (auto-restarts on file changes)
npm start         # production
```

API runs on `http://localhost:4000` by default.

---

## Connecting the Frontend

The entire frontend migration is a **one-line change** in `js/shared/api.js`:

```js
// Before (V1 — localStorage)
export const IS_BACKEND_CONNECTED = false;

// After (V2 — PostgreSQL backend)
export const IS_BACKEND_CONNECTED = true;
export const API_BASE_URL = 'http://localhost:4000/api';
```

A complete V2 version of `api.js` is provided in `backend/src/utils/api_v2_template.js`.
Copy it to `js/shared/api.js` to replace the V1 version.

---

## API Reference

### Health

```
GET  /api/health
```

### Pricing

```
GET  /api/pricing           Returns active pricing (same shape as V1 getPricing())
PUT  /api/pricing           Admin updates pricing; creates audit log entry
```

**PUT body:**
```json
{
  "ps4": 25,
  "ps5": 30,
  "missionPrice": 50,
  "missionInterval": 30,
  "changedBy": "admin"
}
```

### Consoles

```
GET    /api/consoles           List all active consoles with current session state
POST   /api/consoles           Add a console
PATCH  /api/consoles/:id       Rename a console (blocked if session is active)
DELETE /api/consoles/:id       Soft-delete a console (blocked if session is active)
```

**POST body:**
```json
{ "name": "PS4-05", "type": "PS4" }
```

### Sessions

```
POST   /api/sessions               Start a new console session
PATCH  /api/sessions/:id/pause     Pause (freezes both timers)
PATCH  /api/sessions/:id/resume    Resume (restarts both timers)
PATCH  /api/sessions/:id/end       End session (blocked if unpaid bubbles exist)
PATCH  /api/sessions/:id/mode      Toggle FIFA / MISSION
GET    /api/sessions/active        List all currently active sessions
```

**POST body:**
```json
{ "consoleName": "PS4-01", "mode": "FIFA" }
```

### Matches (Bubbles)

```
POST  /api/sessions/:id/matches    Add one match bubble (manual or auto)
GET   /api/sessions/:id/matches    List match bubbles for a session
```

**POST body:**
```json
{ "isAuto": false }
```

The match price is automatically read from the current active pricing.
In FIFA mode, the match cycle timer is immediately reset to 00:00.

### Transactions

```
GET  /api/transactions             List transactions
GET  /api/transactions/export      Download CSV
POST /api/transactions             Record a payment (marks bubbles as paid)
```

**Query params (GET):** `date` (today|yesterday|week|month|all), `method`, `search`, `skip`, `take`

**POST body:**
```json
{
  "matchIds":    [1, 2, 3],
  "method":      "Mobile_Banking",
  "provider":    "Telebirr",
  "consoleName": "PS4-01",
  "description": "2 matches paid"
}
```

### Workers

```
GET    /api/workers          List workers (PIN hash never returned)
POST   /api/workers          Add worker
PATCH  /api/workers/:id      Edit name, PIN, role, or active status
DELETE /api/workers/:id      Soft-deactivate
```

### Reports

```
GET  /api/reports/daily      Today's summary
GET  /api/reports/weekly     Last 7 days
GET  /api/reports/monthly    This calendar month
```

**Response includes:** totalRevenue, cashRevenue, mobileRevenue, telebirrRevenue, cbeRevenue, consolePerformance[], transactions[]

### Settings

```
GET  /api/settings           Load business settings
PUT  /api/settings           Save business settings
```

---

## Database Schema Overview

| Table | Purpose |
|-------|---------|
| `business_settings` | Singleton: business name, location, currency, timezone |
| `workers` | Staff accounts with bcrypt-hashed PINs |
| `consoles` | PS4/PS5 devices (soft-deletable) |
| `pricing` | Versioned pricing with valid_from / valid_until |
| `pricing_audit_log` | Immutable record of every pricing change |
| `shifts` | Worker day-shifts (for future auth) |
| `game_sessions` | One row per console session; stores both timers |
| `matches` | One row per payment bubble; price snapshot immutable |
| `transactions` | One row per payment event |
| `transaction_matches` | Many-to-many bridge: transaction ↔ matches |

### Key Design Decisions

1. **Price immutability** — `matches.price_etb` is set at creation time and never updated. Historical transactions always show the price that was charged, regardless of later admin changes.

2. **Independent timers** — `game_sessions` stores both `elapsed_seconds` (session timer) and `match_timer_elapsed` (match cycle timer). They are frozen independently on pause.

3. **Versioned pricing** — Every pricing update expires old rows (`valid_until = now()`) and inserts new rows. The `active_pricing` view always shows the latest.

4. **Soft deletion** — Consoles and workers use `is_active = false` rather than hard deletes. Historical sessions and transactions retain their references.

5. **Console name denormalization** — `transactions.console_name` is stored as text. If a console is renamed, historical transactions still show the original name.

---

## Security Notes (Production)

- **Change all default PINs** immediately after seeding.
- Run behind HTTPS (nginx or Caddy reverse proxy).
- Set `NODE_ENV=production` to suppress query logs.
- Restrict `CORS_ORIGINS` to your actual frontend domain only.
- Rotate `JWT_SECRET` if compromised (all sessions invalidated).
- Restrict PostgreSQL access to localhost or a private network.

---

## Prisma Commands Reference

```bash
npx prisma generate          # Regenerate the Prisma client
npx prisma migrate dev       # Apply pending migrations (dev)
npx prisma migrate deploy    # Apply migrations (production)
npx prisma studio            # Open Prisma Studio browser UI
npx prisma migrate reset     # Drop and recreate all tables (dev only)
```
