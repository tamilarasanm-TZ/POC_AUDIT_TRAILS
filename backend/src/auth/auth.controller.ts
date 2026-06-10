import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto, RegisterDto } from './dto';
import { AuditActions } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { getRequestContext, patchRequestContext } from '../audit/request-context';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    // Suppress the Prisma extension's generic CREATE for this request — we
    // want a semantic AUTH.REGISTER event instead.
    patchRequestContext({ skipAudit: true });
    const user = await this.auth.register(dto);
    patchRequestContext({ skipAudit: false, actorId: user.id, actorEmail: user.email });

    this.audit.track({
      ctx: getRequestContext() ?? {},
      action: AuditActions.REGISTER,
      entity: 'User',
      entityId: user.id,
      after: user,
      statusCode: 201,
    });
    return user;
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    try {
      const result = await this.auth.login(dto);
      patchRequestContext({ actorId: result.user.id, actorEmail: result.user.email });

      this.audit.track({
        ctx: getRequestContext() ?? {},
        action: AuditActions.LOGIN_SUCCESS,
        entity: 'User',
        entityId: result.user.id,
        metadata: { email: dto.email },
        statusCode: 200,
      });
      return result;
    } catch (e) {
      patchRequestContext({ actorEmail: dto.email });
      this.audit.track({
        ctx: getRequestContext() ?? {},
        action: AuditActions.LOGIN_FAILURE,
        entity: 'User',
        metadata: { email: dto.email, reason: 'invalid_credentials' },
        statusCode: 401,
      });
      throw e instanceof UnauthorizedException ? e : new UnauthorizedException('Invalid credentials');
    }
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any) {
    const user = req.user;
    this.audit.track({
      ctx: getRequestContext() ?? {},
      action: AuditActions.LOGOUT,
      entity: 'User',
      entityId: user.userId,
      statusCode: 200,
    });
    return { ok: true };
  }
}
