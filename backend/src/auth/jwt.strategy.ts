import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { patchRequestContext } from '../audit/request-context';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret',
    });
  }

  async validate(payload: any) {
    // Push the actor into ALS so the Prisma extension stamps the right userId
    // on any audited DB write that happens during this request.
    patchRequestContext({
      actorId: payload.sub,
      actorEmail: payload.email,
    });
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
