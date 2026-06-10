# Production-Grade Recommendations

A condensed checklist of what you'd add to move this POC toward production.

## Durability
- [ ] Replace in-process `EventEmitter2` with the **transactional outbox** pattern: write the audit event in the same DB transaction as the business mutation, then a worker drains it into `audit_logs`. No more "crashed between emit and persist" gap.
- [ ] One audit-writer process (or a leader-elected pool) consumes the outbox so the chain stays single-threaded.

## Tamper Protection
- [ ] Run the app with a DB role that has `INSERT, SELECT` only on `audit_logs` — `REVOKE UPDATE, DELETE, TRUNCATE`.
- [ ] Nightly job: take the latest `hash`, write it to S3 with Object Lock (WORM). Even a DB admin who tampers can't change the WORM-stored checkpoint.
- [ ] Daily `verifyChain()` in CI/cron with paging alert on mismatch.

## Capture Coverage
- [ ] Add `READ` events for sensitive entities (PHI, financial data) — currently only writes are captured.
- [ ] Capture admin console actions (DB shell access, infrastructure changes) — out of NestJS scope, needs OS-level auditing.
- [ ] Audit token revocation / forced logout / failed-MFA events when MFA is added.

## Redaction & Privacy
- [ ] Replace the hardcoded redact-key list with a per-entity `@Sensitive()` decorator declared on Prisma models.
- [ ] PII tokenization for email/SSN in payloads (regulated envs only).
- [ ] Document a **DSR (data subject request)** procedure: how do you respond to a GDPR erasure request when the audit trail must remain intact? Common answer: redact PII *fields* but keep the row's hash valid (the hash covers the canonical row, including the redaction marker).

## Operational
- [ ] Partition `audit_logs` by month; automate partition rollover.
- [ ] Retention policy in code (cron job) with separate hot / warm / cold tiers.
- [ ] Monitor: audit queue depth, write p99, chain-verify runtime, failed inserts.
- [ ] Distributed tracing: include OpenTelemetry `traceId` in `requestId`/`metadata` for cross-service correlation.

## Multi-Service Pipeline
- [ ] If you have more than one NestJS service: each emits to a central audit service via Kafka / NATS / gRPC; one writer process owns the chain.
- [ ] Trust boundary: audit events from untrusted services must be signed with that service's key, verified by the audit writer before insertion.

## Reporting / SIEM
- [ ] Forward audit events to your SIEM (Splunk, Datadog, ELK) for alerting on suspicious patterns (e.g., 10 `LOGIN_FAILURE` from same IP in 1 minute).
- [ ] Pre-built reports: "all permission changes this quarter", "all deletes by user X", "all access to entity Y".

## Testing
- [ ] Property-based test: random sequence of audited operations → `verifyChain()` always passes.
- [ ] Chaos test: kill the writer mid-batch; with outbox, no events lost.
- [ ] Load test: confirm audit overhead stays bounded under k=1000 RPS.

## Compliance Hardening (when applicable)
- [ ] Time sync (NTP/Chrony) monitored.
- [ ] Documented retention durations matching the relevant regulation (SOX 7y, HIPAA 6y, etc.).
- [ ] Access to audit data itself audited (meta-audit).
- [ ] Periodic third-party review of audit completeness.

## Things to deliberately NOT do
- ❌ Don't put audit writes on the request critical path — adds latency without benefit.
- ❌ Don't allow free-text from clients into `metadata` without size limits — DoS vector.
- ❌ Don't log secrets even temporarily for debugging — they end up in backups forever.
- ❌ Don't promise "immutable" without WORM-style external checkpoints — a hash chain alone is detection, not prevention.
