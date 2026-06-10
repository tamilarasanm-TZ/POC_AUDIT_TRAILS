# Performance & Scalability

## Where the cost lands

Each audited HTTP request incurs:
1. **Synchronous** — sanitization + event emit (negligible, microseconds).
2. **Asynchronous** — one `SELECT last hash` + one `INSERT` per audit row.

The request response is **not** blocked by the audit write. End-user latency is unchanged.

## Hot path numbers (rough, local dev)

On a developer laptop with Postgres + Node on the same machine:
- Order PATCH without audit: ~6–10 ms p50
- Order PATCH with audit (write deferred): ~6–10 ms p50 (unchanged)
- Audit write itself: ~3–6 ms p50

Run `npx autocannon -c 50 -d 30 http://localhost:3000/orders` against an authenticated endpoint to validate in your own env.

## Bottlenecks at scale

### 1. Hash-chain serialization
The chain requires `prevHash` from the *most recent* row, so writes must be serialized. The current `writeQueue` does this in-process. Under heavy fanout this is the choke point.

**Solutions:**
- **Per-tenant / per-shard chains** — chain by (tenantId, entity) so contention drops. Verification becomes per-chain.
- **Outbox + single writer** — application writes to an `outbox` table in the request transaction; one writer drains it serially into `audit_logs`. Writes are now durable and the user-facing transaction still commits independently.
- **Sequencer process** — a dedicated audit-writer service consumes events from Kafka/Redis-Streams and is the only thing writing to `audit_logs`. The hot path becomes "send to queue" (sub-millisecond).

### 2. Read load on `audit_logs`
Investigations grep for "what did user X do" or "what happened to entity Y". The included indexes cover those. For full-text on `metadata` JSON, add `GIN` indexes on specific JSON paths or replicate to Elasticsearch / OpenSearch (out of scope for this POC).

### 3. Storage growth
A busy API can produce GBs/day. Mitigations:
- Sample read events (e.g., 1% of GETs) — keep all writes.
- Partition by month (see [schema.md](schema.md)).
- Compress old partitions and offload to S3.

## Observability

For production audit pipelines, monitor:
- Backlog depth on the audit queue
- Audit write latency p99
- `verifyChain()` runtime (grows linearly — checkpoint to avoid full scans)
- Failed inserts (should alert)

## What's intentionally NOT scaled in the POC

- Multiple writers (would break chain ordering — needs outbox)
- Elasticsearch (deferred per requirements)
- Distributed tracing correlation (would tie `requestId` to OpenTelemetry traceId)
- Backpressure (the in-process queue can balloon if Postgres is slow — durable queue solves this)
