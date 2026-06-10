import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuid } from 'uuid';
import { AUDIT_EVENT, AuditActions, AuditEventPayload } from './audit.constants';
import { getRequestContext } from './request-context';
import { isAudited, redactRow } from './audit-policy';

/**
 * Returns a Prisma client wrapped with an audit extension.
 *
 * The extension hooks every write at the data layer:
 *   create / update / delete / upsert / updateMany / deleteMany
 *
 * For UPDATE / DELETE it reads the previous row(s) so the audit event carries
 * a real `before` snapshot — the same data your service-level audit.track()
 * was capturing, but for ALL models in AUDITED_MODELS automatically.
 *
 * Actor / IP / requestId are pulled from AsyncLocalStorage (request-context.ts).
 */
export function withAuditExtension(
  base: PrismaClient,
  events: EventEmitter2,
) {
  // We need a baseline client for the pre-write reads so we don't recurse
  // back into the extension (which would loop forever on findUnique calls).
  const reader = base;

  const emit = (action: string, model: string, payload: Partial<AuditEventPayload>) => {
    const ctx = getRequestContext();
    if (ctx?.skipAudit) return;

    const event: AuditEventPayload = {
      requestId: ctx?.requestId ?? uuid(),
      userId: ctx?.actorId ?? null,
      userEmail: ctx?.actorEmail ?? null,
      action,
      entity: model,
      ipAddress: ctx?.ip ?? null,
      userAgent: ctx?.ua ?? null,
      httpMethod: ctx?.method ?? null,
      url: ctx?.url ?? null,
      ...payload,
    };
    events.emit(AUDIT_EVENT, event);
  };

  // App-level append-only enforcement for the audit table. The DB itself
  // should also REVOKE UPDATE/DELETE for production; this is defense in depth.
  const APPEND_ONLY = new Set(['AuditLog']);
  const blockIfAppendOnly = (model: string, op: string) => {
    if (APPEND_ONLY.has(model)) {
      throw new Error(`Operation '${op}' is forbidden on append-only model '${model}'`);
    }
  };

  return base.$extends({
    name: 'audit',
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const after: any = await query(args);
          if (isAudited(model)) {
            emit(AuditActions.CREATE, model, {
              entityId: after?.id ?? null,
              after: redactRow(model, after),
            });
          }
          return after;
        },

        async update({ model, args, query }) {
          blockIfAppendOnly(model, 'update');
          if (!isAudited(model)) return query(args);
          const before: any = await (reader as any)[lowerFirst(model)].findUnique({
            where: args.where,
          });
          const after: any = await query(args);
          emit(AuditActions.UPDATE, model, {
            entityId: after?.id ?? before?.id ?? null,
            before: redactRow(model, before),
            after: redactRow(model, after),
            metadata: { diff: diffObjects(redactRow(model, before), redactRow(model, after)) },
          });
          return after;
        },

        async upsert({ model, args, query }) {
          blockIfAppendOnly(model, 'upsert');
          if (!isAudited(model)) return query(args);
          const before: any = await (reader as any)[lowerFirst(model)].findUnique({
            where: args.where,
          });
          const after: any = await query(args);
          emit(before ? AuditActions.UPDATE : AuditActions.CREATE, model, {
            entityId: after?.id ?? null,
            before: before ? redactRow(model, before) : null,
            after: redactRow(model, after),
            metadata: before
              ? { diff: diffObjects(redactRow(model, before), redactRow(model, after)) }
              : null,
          });
          return after;
        },

        async delete({ model, args, query }) {
          blockIfAppendOnly(model, 'delete');
          if (!isAudited(model)) return query(args);
          const before: any = await (reader as any)[lowerFirst(model)].findUnique({
            where: args.where,
          });
          const result: any = await query(args);
          emit(AuditActions.DELETE, model, {
            entityId: before?.id ?? null,
            before: redactRow(model, before),
          });
          return result;
        },

        async updateMany({ model, args, query }) {
          blockIfAppendOnly(model, 'updateMany');
          if (!isAudited(model)) return query(args);
          const beforeRows: any[] = await (reader as any)[lowerFirst(model)].findMany({
            where: args.where,
          });
          const result = await query(args);
          // Re-read affected rows for the after-state. updateMany doesn't
          // return them by default; we trust the ids from the before-snapshot.
          const ids = beforeRows.map((r) => r.id);
          const afterRows: any[] = ids.length
            ? await (reader as any)[lowerFirst(model)].findMany({ where: { id: { in: ids } } })
            : [];
          const afterById = new Map(afterRows.map((r) => [r.id, r]));

          for (const before of beforeRows) {
            const after = afterById.get(before.id) ?? null;
            emit(AuditActions.UPDATE, model, {
              entityId: before.id,
              before: redactRow(model, before),
              after: after ? redactRow(model, after) : null,
              metadata: {
                bulk: true,
                diff: diffObjects(redactRow(model, before), redactRow(model, after)),
              },
            });
          }
          return result;
        },

        async deleteMany({ model, args, query }) {
          blockIfAppendOnly(model, 'deleteMany');
          if (!isAudited(model)) return query(args);
          const beforeRows: any[] = await (reader as any)[lowerFirst(model)].findMany({
            where: args.where,
          });
          const result = await query(args);
          for (const before of beforeRows) {
            emit(AuditActions.DELETE, model, {
              entityId: before.id,
              before: redactRow(model, before),
              metadata: { bulk: true },
            });
          }
          return result;
        },
      },
    },
  });
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function diffObjects(a: any, b: any): Record<string, { from: any; to: any }> {
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
