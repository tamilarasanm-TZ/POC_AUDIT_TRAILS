import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { withAuditExtension } from '../audit/audit-extension';

/**
 * PrismaService exposes the audit-extended client.
 *
 * - The base PrismaClient is constructed normally.
 * - `withAuditExtension` wraps it so every create/update/delete on an audited
 *   model auto-emits an 'audit.event' on the EventEmitter2 bus.
 * - Consumers (services) only ever see the extended client — they don't need
 *   to know auditing happens.
 *
 * Inheritance trick: we extend a dynamic class returned from
 * `withAuditExtension(...).constructor` so the public type is the extended
 * client, while NestJS DI still treats this as a single injectable.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // The audit-extended client. Use this everywhere; methods on it have the
  // extension's behaviour wrapped around them.
  public readonly client: ReturnType<typeof withAuditExtension>;

  constructor(events: EventEmitter2) {
    super();
    this.client = withAuditExtension(this as unknown as PrismaClient, events);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
