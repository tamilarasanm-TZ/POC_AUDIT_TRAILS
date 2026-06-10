import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderDto } from './dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(currentUserId?: string, isAdmin?: boolean) {
    if (isAdmin) {
      return this.prisma.client.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } } },
      });
    }
    return this.prisma.client.order.findMany({
      where: { userId: currentUserId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const o = await this.prisma.client.order.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Order not found');
    return o;
  }

  // No audit code. The Prisma extension auto-emits CREATE with the new row
  // as `after`.
  create(userId: string, dto: CreateOrderDto) {
    return this.prisma.client.order.create({
      data: {
        userId,
        product: dto.product,
        quantity: dto.quantity,
        amount: dto.amount,
        status: dto.status ?? 'PENDING',
      },
    });
  }

  // No audit code. The extension reads the row, performs the update, and
  // emits UPDATE with before/after/diff automatically.
  async update(id: string, dto: UpdateOrderDto) {
    // Throw 404 if the row doesn't exist before letting the extension run.
    const exists = await this.prisma.client.order.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Order not found');
    return this.prisma.client.order.update({ where: { id }, data: dto });
  }

  // No audit code. The extension reads before, deletes, emits DELETE.
  async remove(id: string) {
    const exists = await this.prisma.client.order.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Order not found');
    await this.prisma.client.order.delete({ where: { id } });
    return { ok: true };
  }
}
