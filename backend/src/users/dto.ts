import { IsEmail, IsOptional, IsString, MinLength, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class UpdateUserDto {
  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsEnum(Role)
  role?: Role;
}
