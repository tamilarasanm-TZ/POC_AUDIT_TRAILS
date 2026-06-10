import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto } from './dto';
import { SkipAudit } from '../audit/audit.decorator';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @SkipAudit()
  list(@Req() req: any) {
    return this.orders.findAll(req.user.userId, req.user.role === 'ADMIN');
  }

  @Get(':id')
  @SkipAudit()
  one(@Param('id') id: string) {
    return this.orders.findOne(id);
  }

  // No @Audit() decorator needed — the Prisma extension emits CREATE.
  @Post()
  create(@Body() dto: CreateOrderDto, @Req() req: any) {
    return this.orders.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.orders.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orders.remove(id);
  }
}
