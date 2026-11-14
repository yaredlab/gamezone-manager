# GameZone Manager V1

A professional game-centre management system for tracking PS4/PS5 console sessions, match payments, and daily revenue.

Built with vanilla **HTML, CSS and JavaScript ES Modules**. No frameworks, no backend required for V1.

---

## Project Structure

```
gamezone-manager/
│
├── index.html          ← Worker Dashboard (main entry point)
├── admin.html          ← Admin Dashboard
├── README.md
│
├── assets/
│   ├── images/         ← Logos, backgrounds (add as needed)
│   └── icons/          ← Icon assets (add as needed)
│
├── css/
│   ├── variables.css   ← All CSS tokens (colours, spacing, fonts)
│   ├── main.css        ← Global resets, shared components
│   ├── worker.css      ← Worker Dashboard specific styles
│   ├── admin.css       ← Admin Dashboard specific styles
│   └── responsive.css  ← Breakpoints for both dashboards
│
├── js/
│   ├── shared/                   ← Shared by both dashboards
│   │   ├── helpers.js            ← Pure math/formatting — no imports
│   │   ├── storage.js            ← localStorage read/write, state init
│   │   └── api.js                ← API layer (localStorage now, REST in V2)
│   │
│   ├── worker/                   ← Worker Dashboard modules
│   │   ├── app.js                ← Entry point, renderAll(), timer
│   │   ├── consoles.js           ← Card renderer, delegated click handler
│   │   ├── sessions.js           ← Start/pause/resume/end/mode/match
│   │   ├── payments.js           ← Bubble selection, payment recording
│   │   ├── calculator.js         ← ETB calculator widget
│   │   └── dashboard.js          ← Stats bar, transactions list, eye toggle
│   │
│   └── admin/                    ← Admin Dashboard modules
│       ├── app.js                ← Entry point, navigation router, renderAll()
│       ├── overview.js           ← Stats cards, payment bars, recent transactions
│       ├── transactions.js       ← Full history, search, filter, CSV export
│       ├── consoles.js           ← Console management table, add/rename/remove
│       ├── workers.js            ← Worker accounts list, add/edit/toggle
│       ├── pricing.js            ← Price form, save to shared storage
│       ├── reports.js            ← Daily/weekly/monthly summaries, CSV export
│       └── settings.js           ← Business info, system preferences
│
├── database/
│   └── schema.sql      ← Full PostgreSQL schema (placeholder, not connected)
│
└── backend/
    └── README.md       ← Backend roadmap and planned API endpoints
```

---

## How to Run

### VS Code Live Server (recommended)

1. Open VS Code
2. Open the `gamezone-manager/` folder as your workspace root
3. Install the **Live Server** extension (by Ritwick Dey) if not already installed
4. Right-click `index.html` → **Open with Live Server** → Worker Dashboard opens at `http://127.0.0.1:5500/`
5. Navigate to `http://127.0.0.1:5500/admin.html` for the Admin Dashboard

> **Important:** ES Modules require an HTTP server. Opening `index.html` directly as a `file://` URL **will not work**.

### Python (alternative)

```bash
cd gamezone-manager
python -m http.server 5500
```

Then open:
- `http://localhost:5500/` — Worker Dashboard
- `http://localhost:5500/admin.html` — Admin Dashboard

---

## Dashboards

### Worker Dashboard (`index.html`)
Used by game-centre staff to manage daily operations.

| Feature | Description |
|---|---|
| Console grid | PS4/PS5 cards with live status |
| Session control | Start / Pause / Resume / End |
| Match bubbles | One bubble per FIFA match, click to select |
| Payment recording | Cash, Telebirr, CBE Mobile Banking |
| Stats bar | Daily collected, matches, active sessions, unpaid balance |
| Eye toggle | Hide/show financial totals |
| Calculator | Independent ETB calculator |
| Persistence | All data saved to localStorage automatically |

### Admin Dashboard (`admin.html`)
Used by the owner/manager for oversight and configuration.

| Page | Features |
|---|---|
| Overview | Daily/monthly totals, payment method bars, console activity, recent transactions |
| Transactions | Full history, search, filter by method, CSV export |
| Consoles | Add, rename, remove consoles — changes apply to Worker Dashboard immediately |
| Workers | Add/edit/activate/deactivate worker accounts |
| Pricing | Change PS4/PS5/Mission prices — stored separately from session data |
| Reports | Daily/weekly/monthly summaries, console performance, payment breakdown, CSV export |
| Settings | Business name, location, phone, currency, timezone |

---

## Pricing Configuration & Synchronization

| Mode | Target | Default Price | Billing Interval |
|---|---|---|---|
| FIFA Match Mode | PS4 Console | 25 ETB | Per match bubble (resets timer on each match) |
| FIFA Match Mode | PS5 Console | 30 ETB | Per match bubble (resets timer on each match) |
| Mission Mode | All Consoles | 50 ETB | Every 30 minutes (automatically adds 1 Bubble) |

- **Centralized Admin Management:** All prices and billing intervals are configured centrally in `admin.html`.
- **Real-Time Synchronization:** Updates synchronize immediately to `index.html` across browser tabs without requiring a manual refresh.
- **Historical Price Retention:** Each match and bubble stores its creation price (`price_etb`); past transactions and existing matches are never altered by price changes.

---

## Timers & Billing System

### 1. Match Mode (FIFA)
- Counts upward from `00:00` for each active match.
- When the worker clicks **"+ 1 MATCH"** (or when the 4-minute cycle completes), the timer **immediately resets to 00:00** and counts fresh for the new match.
- Previous match time stops completely and does not carry over.
- Only one timer runs per active console session.
- Survives browser refresh (continues from exact elapsed timestamp).

### 2. Mission Mode
- Continuous session timer counts from `00:00` upward without resetting.
- **Automatic Bubble Addition:**
  - 00:00–29:59 → 0 Bubbles (0 ETB)
  - At 30:00 → 1 Bubble added automatically (50 ETB)
  - At 60:00 → 2nd Bubble added automatically (100 ETB)
  - At 90:00 → 3rd Bubble added automatically (150 ETB)
  - At 120:00 → 4th Bubble added automatically (200 ETB)
- Prevents duplicate bubble additions for the same interval.
- Each bubble is an interactive payment bubble that workers can select and mark as PAID via Cash or Mobile Banking (Telebirr / CBE).

---

## Data Architecture

### Shared localStorage keys

| Key | Owner | Contents |
|---|---|---|
| `gamezone-worker-v1` | Worker & Admin | Consoles, sessions, matches, transactions |
| `gamezone-admin-pricing` | Admin | Custom pricing overrides |
| `gamezone-admin-workers` | Admin | Worker account list |
| `gamezone-admin-settings` | Admin | Business info and preferences |

### How data flows

```
Worker Dashboard          Admin Dashboard
     │                          │
     ▼                          ▼
js/shared/storage.js ←──────────┤
     │                    js/shared/api.js
     ▼
localStorage ("gamezone-worker-v1")
```

Both dashboards read and write the same `gamezone-worker-v1` key. Console changes made in the Admin Dashboard are immediately visible in the Worker Dashboard on the next page interaction or refresh.

---

## Module Dependency Graph

```
index.html ──► js/worker/app.js
                    ├── js/shared/storage.js
                    ├── js/worker/consoles.js ──► js/worker/sessions.js ──► js/shared/helpers.js
                    ├── js/worker/payments.js ──► js/shared/helpers.js
                    ├── js/worker/calculator.js
                    └── js/worker/dashboard.js ──► js/shared/helpers.js

admin.html ──► js/admin/app.js
                    ├── js/admin/overview.js ────► js/shared/helpers.js, api.js
                    ├── js/admin/transactions.js ► js/shared/helpers.js
                    ├── js/admin/consoles.js ────► js/shared/storage.js, api.js
                    ├── js/admin/workers.js ─────► js/shared/api.js
                    ├── js/admin/pricing.js ─────► js/shared/api.js
                    ├── js/admin/reports.js ─────► js/shared/helpers.js
                    └── js/admin/settings.js ────► js/shared/api.js

js/shared/helpers.js  ← zero imports (pure functions only)
js/shared/storage.js  ← zero app imports
js/shared/api.js      ← imports storage.js only
```

---

## Browser Support

| Browser | Minimum version |
|---|---|
| Chrome | 80+ |
| Edge | 80+ |
| Firefox | 80+ |
| Safari | 14+ |

Requires: CSS Custom Properties, CSS Grid, ES2020 Modules.

---

## V2 Roadmap

- [ ] PostgreSQL backend (see `database/schema.sql`)
- [ ] Worker login with PIN authentication
- [ ] Admin password authentication
- [ ] Real-time session sync across devices (WebSockets)
- [ ] Receipt image uploads
- [ ] PDF receipt generation
- [ ] Inventory and accessory tracking
- [ ] Manager reports with date-range filtering

See `backend/README.md` for the full planned API specification.

---

## Important Notes

- All data is stored in **this browser only**. Clearing browser data resets the app.
- The Admin Dashboard is not password-protected in V1. Do not use on a shared computer without understanding this.
- `database/schema.sql` is a design reference for V2 — it is not connected.
- All prices are in **Ethiopian Birr (ETB)**.

---

*GameZone Manager · V1.0 · Worker + Admin Dashboard · Built with HTML / CSS / JavaScript*
