# Security, Retention & Compliance

## Threats and Mitigations

| Threat | Mitigation in POC | Production hardening |
|---|---|---|
| Attacker deletes/edits log rows | SHA-256 hash chain; `verifyChain()` exposed | Revoke `UPDATE, DELETE` grants; periodic checkpoint hash to WORM (S3 Object Lock) |
| Sensitive data in logs (passwords, tokens) | `sanitize()` redacts known keys; `users.service` strips `passwordHash` | Domain-specific field redaction policy; PII tokenization for emails/SSNs in regulated envs |
| Forged user identity in logs | userId resolved server-side from JWT, not request body | Bind JWT to session, enforce short TTLs, rotate signing keys |
| Replay / log spam | requestId carried per request; rate-limit failed logins | API gateway rate limits, fail2ban-style throttling on `LOGIN_FAILURE` |
| Log volume DoS | EventEmitter2 queue serializes writes | Move to durable queue (Kafka / RabbitMQ / Postgres outbox), use sampling for read events |
| Insider DBA tampering | Hash chain reveals broken sequence | Ship `hash` to external append-only store (object lock S3, or sign daily summary into a transparency log) |

## What Gets Captured

| Domain | Action | Trigger | Payload highlights |
|---|---|---|---|
| Auth | `AUTH.LOGIN_SUCCESS` | Successful POST `/auth/login` | userId, email, ip, ua |
| Auth | `AUTH.LOGIN_FAILURE` | Failed POST `/auth/login` | email tried, ip, ua, reason |
| Auth | `AUTH.LOGOUT` | POST `/auth/logout` | userId |
| Auth | `AUTH.REGISTER` | POST `/auth/register` | new user (passwordHash redacted) |
| Auth | `AUTH.PERMISSION_CHANGE` | Role changed via PATCH /users/:id | `before.role`, `after.role`, actor |
| User | `CREATE` `UPDATE` `DELETE` | CRUD endpoints | full before/after + diff |
| Order | `CREATE` `UPDATE` `DELETE` | CRUD endpoints | full before/after + diff |

## Sensitive Field Redaction

The `sanitize()` helper in `audit.interceptor.ts` redacts the keys `password`, `passwordHash`, `token`, `accessToken` from any object the interceptor captures. The `users.service` additionally strips `passwordHash` from the snapshot it emits.

For a production system, the redaction policy should be **centralized**:
- Each entity declares its sensitive fields in metadata (e.g., a `@Sensitive()` decorator on Prisma models).
- A single sanitizer enforces the policy at audit-write time.
- Different policies for `before` vs `after` (e.g., never log card numbers in either, but log a hash so changes are still detectable).

## Retention

The POC writes indefinitely. Recommended production policy:

| Tier | Duration | Storage |
|---|---|---|
| Hot | 90 days | Postgres `audit_logs` (current partition + N-1) |
| Warm | 1 year | Postgres detached partitions, indexes minimal |
| Cold | 7+ years (compliance-driven) | S3 + Object Lock, Glacier |
| Hash checkpoint | indefinite | S3 Object Lock — small file, never deleted |

A nightly cron (`@nestjs/schedule`) can:
1. Detach the oldest in-scope partition.
2. Export as Parquet/JSON to S3.
3. Write the partition's final hash to the checkpoint object.
4. Drop the detached partition.

## Compliance Considerations

This POC provides the **technical foundation**, not legal compliance. The following frameworks commonly mandate audit logging:

| Framework | Relevant requirement | How this POC helps |
|---|---|---|
| **SOX** | Track who changed financial-system data and when | Before/after diffs + actor identity + immutable chain |
| **HIPAA §164.312(b)** | Audit controls for PHI access | Action/entity/userId capture; need extra read-event capture for "viewed PHI" |
| **GDPR Art. 30 / 32** | Records of processing; security of personal data | DSR fulfilment trails; redaction of PII payloads |
| **PCI DSS 10.x** | Log all access to cardholder data | Same model; **never log PANs**, only tokens / last-4 |
| **ISO 27001 A.12.4** | Event logging, log protection, admin logs | Hash chain + restricted writers + periodic verification |

**A real compliance program needs more than this POC supplies:**
- Time synchronization (NTP) across servers — audit timestamps must be trustworthy.
- Centralized log aggregation across services (this POC is one service).
- Defined log review cadence and incident-response triggers.
- Legal review of retention duration per jurisdiction.

## Time Source

The POC uses `DateTime @default(now())` which is the database wall clock. In production, ensure NTP is healthy on the DB host and consider also recording `request.start` from the application as a separate field — clock skew between app and DB has bitten people during forensic timelines.
