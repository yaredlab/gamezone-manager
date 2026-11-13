# GameZone Manager — Backend Roadmap

This directory is a placeholder for the future server-side backend.

## Current Status: Frontend Only (V1)

The V1 system is a fully functional frontend using:
- **Browser localStorage** for data persistence
- **No server required** — runs with VS Code Live Server or any static HTTP server
- **No real authentication** — the Admin Dashboard is not password-protected yet

---

## Planned Backend Stack (V2)

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express.js or Fastify |
| Database | PostgreSQL 15+ |
| ORM | Prisma or Drizzle |
| Auth | JWT + bcrypt PIN hashing |
| Real-time | WebSockets (Socket.IO) for live session sync |
| File storage | Local filesystem or S3 (receipt images) |

---

## Planned API Endpoints

### Auth
```
POST   /api/auth/worker/login      Worker PIN login
POST   /api/auth/admin/login       Admin password login
POST   /api/auth/logout            Invalidate session token
GET    /api/auth/me                Get current user info
```

### Consoles
```
GET    /api/consoles               List all consoles
POST   /api/consoles               Add a console (admin only)
PATCH  /api/consoles/:id           Rename a console (admin only)
DELETE /api/consoles/:id           Remove a console (admin only)
```

### Sessions
```
GET    /api/sessions               List active sessions
POST   /api/sessions               Start a session
PATCH  /api/sessions/:id/pause     Pause a session
PATCH  /api/sessions/:id/resume    Resume a session
DELETE /api/sessions/:id           End a session
```

### Matches
```
POST   /api/sessions/:id/matches   Add a match bubble
```

### Transactions
```
GET    /api/transactions           List transactions (supports date/method filters)
POST   /api/transactions           Record a payment
GET    /api/transactions/export    Export CSV
```

### Pricing
```
GET    /api/pricing                Get current pricing
PUT    /api/pricing                Update pricing (admin only, creates audit log)
```

### Workers
```
GET    /api/workers                List workers (admin only)
POST   /api/workers                Add a worker (admin only)
PATCH  /api/workers/:id            Edit worker (admin only)
DELETE /api/workers/:id            Remove a worker (admin only)
```

### Reports
```
GET    /api/reports/daily          Daily summary
GET    /api/reports/weekly         Weekly summary
GET    /api/reports/monthly        Monthly summary
```

---

## Migration Path from V1 to V2

The frontend is already structured for this migration:

1. **`js/shared/api.js`** is the single file to update.
   - Replace `loadState()` / `saveState()` calls with `fetch()` calls to the REST API.
   - All other modules import from `api.js` — no other files need changing.

2. **`js/shared/storage.js`** becomes a cache layer for offline support.

3. Set `IS_BACKEND_CONNECTED = true` in `api.js` and configure `API_BASE_URL`.

---

## Database Schema

See `../database/schema.sql` for the full PostgreSQL table definitions.

---

## Security Notes for V2

- Admin Dashboard must be served on a separate subdomain or behind authentication middleware
- Worker PINs must be hashed with bcrypt (never stored in plain text)
- All API routes must validate JWT tokens
- Admin-only routes must enforce role checks server-side
- HTTPS required in production
- CORS must be configured to allow only your frontend origin

---

*This file is a planning document. No backend code exists in V1.*
