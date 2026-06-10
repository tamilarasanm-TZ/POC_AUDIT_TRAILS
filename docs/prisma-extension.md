# Audit via Prisma Extension

The POC now uses a Prisma client extension as the primary capture mechanism.
This document explains what changed, why, and how to extend it.

## What it replaces

| Concern | Before | After |
|---|---|---|
| CREATE on User/Order | `audit.track()` call inside `service.create()` | Auto-emitted by Prisma extension |
| UPDATE on User/Order | Manual read-before + `audit.track()` | Auto-emitted by Prisma extension (with before/after/diff) |
| DELETE on User/Order | Manual read-before + `audit.track()` | Auto-emitted by Prisma extension |
| `updateMany` / `deleteMany` | Not audited | Auto-emitted, one row per affected entity |
| Sensitive field redaction | Per-service inline logic | One policy file: `audit-policy.ts` |
| New audited entity | Edit the service + add audit calls | Add the model name to `AUDITED_MODELS` set |

## What still uses `audit.track()` explicitly

Things the extension *cannot* know about, because they aren't DB writes on
audited models:

- `AUTH.LOGIN_SUCCESS` / `AUTH.LOGIN_FAILURE` / `AUTH.LOGOUT`
- `AUTH.REGISTER` (we suppress the extension's CREATE and emit REGISTER instead)
- `AUTH.PERMISSION_CHANGE` (semantic event; the extension just sees a column change)
- Any non-HTTP trigger (cron, queue consumer, CLI)

## Components

```
┌────────────────────────────────────────────────────────────────┐
│ RequestContextMiddleware (src/audit/request-context.middleware) │
│   - Generates/reads requestId                                   │
│   - Captures IP, UA, method, URL                                │
│   - Stores in AsyncLocalStorage (ALS)                           │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ JwtStrategy.validate()                                          │
│   - After JWT verification, calls patchRequestContext({...})    │
│     to fill actorId + actorEmail into the ALS store             │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ Controller → Service → this.prisma.client.<model>.update(...)   │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ Prisma Extension (src/audit/audit-extension.ts)                 │
│   - $allModels.create / update / delete / upsert / *Many        │
│   - If model is in AUDITED_MODELS:                              │
│       1. Reads `before` via base client (for update/delete)     │
│       2. Calls original query                                   │
│       3. Reads context from ALS (requestId, actor, ip, ua, ...)  │
│       4. Redacts sensitive fields per audit-policy.ts           │
│       5. Emits 'audit.event' on EventEmitter2                   │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ AuditService.handleAuditEvent (async)                           │
│   - Serializes writes via writeQueue                            │
│   - Computes SHA-256 hash chained from previous row             │
│   - INSERT audit_logs                                           │
└────────────────────────────────────────────────────────────────┘
```

## How to audit a new entity

Three steps. No service changes required.

1. **Add the model to the allowlist** in `src/audit/audit-policy.ts`:
   ```ts
   export const AUDITED_MODELS = new Set<string>([
     'User',
     'Order',
     'Invoice',   // ← new
   ]);
   ```

2. **Declare sensitive fields** (if any) in the same file:
   ```ts
   export const SENSITIVE_FIELDS: Record<string, string[]> = {
     User: ['passwordHash'],
     Invoice: ['bankAccountNumber'],
   };
   ```

3. **Use Prisma as usual** in your service:
   ```ts
   // invoices.service.ts
   create(dto) { return this.prisma.client.invoice.create({ data: dto }); }
   update(id, dto) { return this.prisma.client.invoice.update({ where: { id }, data: dto }); }
   remove(id) { return this.prisma.client.invoice.delete({ where: { id } }); }
   ```

Audit rows are now produced for every create/update/delete with full
before/after, redaction, hash chain, and HTTP context — without any audit
code in the service.

## Why `this.prisma.client.<model>` instead of `this.prisma.<model>`

`PrismaService` holds two things:
- `this` is the base `PrismaClient` (needed by the extension itself so its
  `findUnique` calls don't recurse back into the extension and loop forever).
- `this.client` is the audit-extended client. **All application code should
  use this.**

If a developer accidentally calls `this.prisma.order.update(...)` (without
`.client`), the write succeeds but is NOT audited. To detect this, a future
hardening would be a lint rule or — better — only expose `client` publicly
and make the base inaccessible.

## Opt-out per request

If a particular flow must NOT audit (e.g., a data migration script that
runs through HTTP), set the flag in the request context:

```ts
patchRequestContext({ skipAudit: true });
// ... perform writes ...
patchRequestContext({ skipAudit: false });
```

The extension checks `ctx.skipAudit` before emitting.

## Limitations

1. **Non-HTTP code paths** (cron, queue) don't have a request context, so
   audit rows have `null` for userId/IP/requestId. Initialize ALS at the
   start of those handlers if you need attribution.
2. **Raw SQL** (`$executeRaw`, `$queryRaw`) bypasses the extension.
3. **Direct DB connection** (psql, admin tools) bypasses the extension —
   production should solve this with **append-only DB grants** so direct
   writes to audited tables are blocked.
4. **Transactions** — when you wrap multiple writes in `$transaction`, each
   write emits its own event. The events fire on success of each query,
   but the AuditService write is async — if the transaction rolls back,
   the audit rows are already in the queue. For strict correctness, use
   the **outbox pattern** described in `recommendations.md`.

## Trade-offs vs the previous `audit.track()`-everywhere approach

| Aspect | `audit.track()` per service method | Prisma extension |
|---|---|---|
| Boilerplate per entity | ~30 lines | 1 line (allowlist entry) |
| Coverage guarantee | "Don't forget to call it" | All writes captured |
| Auditability of audit logic | Visible inline | Centralized — single source |
| Tested in isolation | Service deps on AuditService | Service deps only on Prisma |
| Custom payload control | Full | Limited (extension picks the shape) |
| Multi-event flows | Easy | Combine with explicit `audit.track()` |
| Non-HTTP triggers | Works | Need ALS init at trigger boundary |
