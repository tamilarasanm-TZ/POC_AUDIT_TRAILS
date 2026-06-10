import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { AUDIT_EVENT, AuditEventPayload } from './audit.constants';

export interface AuditCtx {
  requestId?: string;
  actorId?: string | null;
  actorEmail?: string | null;
  ip?: string | null;
  ua?: string | null;
  method?: string | null;
  url?: string | null;
}

export interface TrackOptions<T = any> {
  ctx: AuditCtx;
  action: string;
  entity?: string;
  entityId?: string;
  before?: T | null;
  after?: T | null;
  metadata?: Record<string, any> | null;
  statusCode?: number;
  // When true, automatically compute & attach diff of before vs after
  withDiff?: boolean;
}

export function diffObjects(
  a: any,
  b: any,
): Record<string, { from: any; to: any }> {
  const diff: Record<string, { from: any; to: any }> = {};
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) {
    const av = a?.[k];
    const bv = b?.[k];
    const aStr = av instanceof Date ? av.toISOString() : JSON.stringify(av);
    const bStr = bv instanceof Date ? bv.toISOString() : JSON.stringify(bv);
    if (aStr !== bStr) diff[k] = { from: av, to: bv };
  }
  return diff;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  // Serialize writes so the hash chain stays consistent under concurrency.
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  // The single entry point services should call. Builds the payload, attaches
  // diff if asked, and emits on the bus. Async listener (handleAuditEvent)
  // does the actual DB write so the caller is not blocked.
  track(opts: TrackOptions): void {
    const { ctx } = opts;
    const metadata = { ...(opts.metadata ?? {}) };
    if (opts.withDiff && opts.before && opts.after) {
      metadata.diff = diffObjects(opts.before, opts.after);
    }
    this.events.emit(AUDIT_EVENT, {
      requestId: ctx.requestId ?? uuid(),
      userId: ctx.actorId ?? null,
      userEmail: ctx.actorEmail ?? null,
      action: opts.action,
      entity: opts.entity ?? null,
      entityId: opts.entityId ?? null,
      before: opts.before ?? null,
      after: opts.after ?? null,
      metadata: Object.keys(metadata).length ? metadata : null,
      ipAddress: ctx.ip ?? null,
      userAgent: ctx.ua ?? null,
      httpMethod: ctx.method ?? null,
      url: ctx.url ?? null,
      statusCode: opts.statusCode ?? null,
    } as AuditEventPayload);
  }

  @OnEvent(AUDIT_EVENT, { async: true })
  async handleAuditEvent(payload: AuditEventPayload) {
    // Chain writes — every event waits for the previous one to finish.
    this.writeQueue = this.writeQueue.then(() => this.persist(payload)).catch((err) => {
      this.logger.error('Audit persist failed', err as Error);
    });
    await this.writeQueue;
  }

  private async persist(payload: AuditEventPayload): Promise<void> {
    const last = await this.prisma.auditLog.findFirst({
      orderBy: { id: 'desc' },
      select: { hash: true },
    });
    const prevHash = last?.hash ?? null;
    const hash = this.computeHash(prevHash, payload);

    await this.prisma.auditLog.create({
      data: {
        requestId: payload.requestId ?? null,
        userId: payload.userId ?? null,
        userEmail: payload.userEmail ?? null,
        action: payload.action,
        entity: payload.entity ?? null,
        entityId: payload.entityId ?? null,
        before: payload.before ?? undefined,
        after: payload.after ?? undefined,
        metadata: payload.metadata ?? undefined,
        ipAddress: payload.ipAddress ?? null,
        userAgent: payload.userAgent ?? null,
        httpMethod: payload.httpMethod ?? null,
        url: payload.url ?? null,
        statusCode: payload.statusCode ?? null,
        prevHash,
        hash,
      },
    });
  }

  private computeHash(prevHash: string | null, payload: AuditEventPayload): string {
    const salt = process.env.AUDIT_HASH_SALT ?? '';
    const canonical = JSON.stringify({
      prevHash,
      requestId: payload.requestId ?? null,
      userId: payload.userId ?? null,
      userEmail: payload.userEmail ?? null,
      action: payload.action,
      entity: payload.entity ?? null,
      entityId: payload.entityId ?? null,
      before: payload.before ?? null,
      after: payload.after ?? null,
      metadata: payload.metadata ?? null,
      ipAddress: payload.ipAddress ?? null,
      userAgent: payload.userAgent ?? null,
      httpMethod: payload.httpMethod ?? null,
      url: payload.url ?? null,
      statusCode: payload.statusCode ?? null,
    });
    return createHash('sha256').update(salt + canonical).digest('hex');
  }

  // Walk the chain and verify every row hash matches recomputed value.
  async verifyChain(): Promise<{ ok: boolean; total: number; brokenAtId?: string }> {
    const rows = await this.prisma.auditLog.findMany({ orderBy: { id: 'asc' } });
    let prevHash: string | null = null;
    for (const row of rows) {
      const expected = this.computeHash(prevHash, {
        requestId: row.requestId ?? undefined,
        userId: row.userId ?? undefined,
        userEmail: row.userEmail ?? undefined,
        action: row.action,
        entity: row.entity ?? undefined,
        entityId: row.entityId ?? undefined,
        before: (row.before as any) ?? null,
        after: (row.after as any) ?? null,
        metadata: (row.metadata as any) ?? null,
        ipAddress: row.ipAddress ?? undefined,
        userAgent: row.userAgent ?? undefined,
        httpMethod: row.httpMethod ?? undefined,
        url: row.url ?? undefined,
        statusCode: row.statusCode ?? undefined,
      });
      if (expected !== row.hash || (row.prevHash ?? null) !== prevHash) {
        return { ok: false, total: rows.length, brokenAtId: row.id.toString() };
      }
      prevHash = row.hash;
    }
    return { ok: true, total: rows.length };
  }
}
