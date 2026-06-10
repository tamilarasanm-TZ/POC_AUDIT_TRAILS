import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class CreateOrderDto {
  @IsString()
  product: string;

  @IsInt() @Min(1)
  quantity: number;

  @IsNumber() @Min(0)
  amount: number;

  @IsOptional() @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class UpdateOrderDto {
  @IsOptional() @IsString()
  product?: string;

  @IsOptional() @IsInt() @Min(1)
  quantity?: number;

  @IsOptional() @IsNumber() @Min(0)
  amount?: number;

  @IsOptional() @IsEnum(OrderStatus)
  status?: OrderStatus;
}
