import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from './audit.service';
import { SkipAudit } from './audit.decorator';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('audit-logs')
export class AuditController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @SkipAudit()
  async list(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) where.timestamp.lte = new Date(to);
    }
    if (q) {
      where.OR = [
        { userEmail: { contains: q, mode: 'insensitive' } },
        { url: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { entity: { contains: q, mode: 'insensitive' } },
      ];
    }
    const take = Math.min(Number(pageSize) || 20, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take,
        skip,
      }),
    ]);

    return {
      total,
      page: Number(page) || 1,
      pageSize: take,
      items: items.map((r) => ({ ...r, id: r.id.toString() })),
    };
  }

  @Get('export.csv')
  @SkipAudit()
  async exportCsv(@Res() res: Response) {
    const items = await this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10000,
    });
    const header = [
      'id', 'timestamp', 'userEmail', 'action', 'entity', 'entityId',
      'httpMethod', 'url', 'statusCode', 'ipAddress', 'hash',
    ];
    const lines = [header.join(',')];
    for (const r of items) {
      lines.push([
        r.id.toString(),
        r.timestamp.toISOString(),
        csv(r.userEmail),
        csv(r.action),
        csv(r.entity),
        csv(r.entityId),
        csv(r.httpMethod),
        csv(r.url),
        r.statusCode ?? '',
        csv(r.ipAddress),
        r.hash,
      ].join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.send(lines.join('\n'));
  }

  @Get('verify')
  @SkipAudit()
  async verify() {
    return this.audit.verifyChain();
  }
}

function csv(v: any): string {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}
