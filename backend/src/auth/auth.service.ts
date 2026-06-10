import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.client.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already in use');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.client.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
      },
    });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  async validate(email: string, password: string) {
    const user = await this.prisma.client.user.findUnique({ where: { email } });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validate(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      accessToken: token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }
}
