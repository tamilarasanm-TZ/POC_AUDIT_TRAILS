# Database Schema

## Core Tables

### `User`

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| email | varchar UNIQUE | |
| passwordHash | varchar | bcrypt, **redacted** from audit |
| name | varchar | |
| role | enum (ADMIN, USER) | |
| createdAt, updatedAt | timestamp | |

### `Order`

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → User) | indexed |
| product | varchar | |
| quantity | int | |
| amount | float | |
| status | enum (PENDING, PAID, SHIPPED, DELIVERED, CANCELLED) | indexed |
| createdAt, updatedAt | timestamp | |

## Audit Table

### `AuditLog`

| Column | Type | Notes |
|---|---|---|
| id | bigserial (PK) | monotonic, defines chain order |
| requestId | varchar | UUID per HTTP request — correlation across multiple emitted events |
| userId | uuid (FK → User, NULL) | NULL for failed logins / system actions |
| userEmail | varchar | snapshotted at write time |
| action | varchar | e.g. `CREATE`, `UPDATE`, `AUTH.LOGIN_SUCCESS` |
| entity | varchar | `User`, `Order`, … |
| entityId | varchar | row PK affected |
| before | jsonb | full row snapshot before change (NULL for CREATE/login) |
| after | jsonb | full row snapshot after change (NULL for DELETE/logout) |
| metadata | jsonb | params/query/diff/reason — flexible bag |
| ipAddress | varchar | extracted from `X-Forwarded-For` or socket |
| userAgent | varchar | |
| httpMethod | varchar | |
| url | varchar | originalUrl |
| statusCode | int | |
| prevHash | varchar(64) | SHA-256 hash of previous row |
| hash | varchar(64) | SHA-256 hash of (salt + JSON of this row + prevHash) |
| timestamp | timestamp | default now() |

### Indexes
- `(userId)` — "show me everything user X did"
- `(entity, entityId)` — "show me everything that happened to Order #abc"
- `(action)` — "show me all login failures"
- `(timestamp)` — date-range queries / retention sweeps

## Append-Only Enforcement

The POC writes to the table normally for development convenience. In production, **revoke UPDATE and DELETE on `audit_logs`** for the application role:

```sql
-- production hardening
CREATE ROLE audit_writer LOGIN PASSWORD '...';
GRANT INSERT, SELECT ON audit_logs TO audit_writer;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM audit_writer;
-- the app connects as audit_writer for the audit module only
```

Even stronger: write audit rows over a second connection that only has `INSERT, SELECT` grants; the app's main connection cannot touch the table at all.

## Why hash chain over signing?

A hash chain detects **any** change, addition, or deletion after the fact, using only data already in the table. Signing each row would require a key management story. Hash chains are also append-only by nature — verifying integrity means walking the chain from the start.

A future enhancement: write the **last hash** to an external WORM target (S3 Object Lock, blockchain timestamping, or a daily checkpoint) so even a DB admin who tampers with the chain and re-hashes can be detected.

## Retention partitioning (recommended for prod)

For high-volume systems, partition `audit_logs` by month:

```sql
CREATE TABLE audit_logs (...) PARTITION BY RANGE (timestamp);
CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
```

Old partitions can be detached and archived to cold storage (S3 + Glacier) without slow `DELETE` operations.
