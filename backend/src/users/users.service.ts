import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { AuditService } from '../audit/audit.service';
import { AuditActions } from '../audit/audit.constants';
import { getRequestContext } from '../audit/request-context';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private redact(u: any) {
    if (!u) return u;
    const { passwordHash, ...rest } = u;
    return rest;
  }

  async findAll() {
    const users = await this.prisma.client.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map((u) => this.redact(u));
  }

  async findOne(id: string) {
    const u = await this.prisma.client.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    return this.redact(u);
  }

  // No CREATE audit code — the extension emits it. We just return the redacted row.
  async create(dto: CreateUserDto) {
    const existing = await this.prisma.client.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = await this.prisma.client.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: dto.role ?? 'USER',
      },
    });
    return this.redact(created);
  }

  async update(id: string, dto: UpdateUserDto) {
    const before = await this.prisma.client.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('User not found');
    const after = await this.prisma.client.user.update({ where: { id }, data: dto });

    // Semantic audit event the extension can't produce on its own: role change.
    // The extension already emits the generic UPDATE separately.
    if (before.role !== after.role) {
      this.audit.track({
        ctx: getRequestContext() ?? {},
        action: AuditActions.PERMISSION_CHANGE,
        entity: 'User',
        entityId: id,
        before: { role: before.role },
        after: { role: after.role },
        statusCode: 200,
      });
    }

    return this.redact(after);
  }

  async remove(id: string) {
    const exists = await this.prisma.client.user.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('User not found');
    await this.prisma.client.user.delete({ where: { id } });
    return { ok: true };
  }
}
