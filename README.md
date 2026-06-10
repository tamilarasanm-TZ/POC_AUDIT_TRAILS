# Audit Trails POC

A NestJS + React proof of concept for centralized, tamper-evident audit logging.

## Stack

- **Backend:** NestJS 10, Prisma, PostgreSQL, JWT auth, EventEmitter2, Swagger
- **Frontend:** React 18, Vite, React Router, Axios
- **Audit pattern:** hybrid — global Interceptor (HTTP metadata + CREATE bodies) + Service-level emitters (UPDATE/DELETE with `before`/`after`) + Event listener (async writes) + SHA-256 hash chain

## Quick Start

### 1. PostgreSQL
You said you're using local Postgres at `localhost:5432`, user `postgres`, password `1412`.
Create the database:
```sql
CREATE DATABASE audit_trails_poc;
```

### 2. Backend
```bash
cd backend
npm install
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```
- API: http://localhost:3000
- Swagger: http://localhost:3000/docs

Seeded users:
- `admin@example.com` / `admin123` (ADMIN)
- `user@example.com` / `user123` (USER)

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
- App: http://localhost:5173

## What to try

1. Log in as admin → create an order → change its status → delete it.
2. Open **Audit Logs** — every action is recorded with `before`/`after`, IP, request ID, hash chain.
3. Click **Verify chain** — recomputes every hash and confirms integrity.
4. Try `Export CSV` for the report.
5. Log in as the regular user — note role-based UI and that they only see their own orders.
6. Try a bad password — `AUTH.LOGIN_FAILURE` is captured.
7. Change a user's role in the Users page — both `UPDATE` and `PERMISSION_CHANGE` are emitted.

## Documentation

- [docs/architecture.md](docs/architecture.md) — components, sequence diagrams
- [docs/prisma-extension.md](docs/prisma-extension.md) — auto-audit via Prisma extension (the primary capture mechanism)
- [docs/schema.md](docs/schema.md) — DB schema & indexes
- [docs/security.md](docs/security.md) — tamper protection, redaction, retention, compliance
- [docs/performance.md](docs/performance.md) — perf considerations & scale path
- [docs/recommendations.md](docs/recommendations.md) — production-grade recommendations

## Folder Layout

```
Audit_Trails/
├── backend/                  NestJS API
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── audit/            interceptor, service (hash chain), controller, decorators
│       ├── auth/             JWT login/logout/register (audited)
│       ├── users/            User CRUD (audited)
│       ├── orders/           Order CRUD (audited)
│       └── prisma/
├── frontend/                 React + Vite
│   └── src/pages/            Login, Users, Orders, AuditLogs
└── docs/
```
