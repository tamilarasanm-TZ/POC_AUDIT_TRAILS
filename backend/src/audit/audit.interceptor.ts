import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, tap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { AUDIT_EVENT, AuditEventPayload } from './audit.constants';
import { AUDIT_META, AuditMeta, SKIP_AUDIT } from './audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly events: EventEmitter2,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT, [
      context.getHandler(),
      context.getClass(),
    ]);
    const meta = this.reflector.getAllAndOverride<AuditMeta>(AUDIT_META, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const requestId = req.headers['x-request-id'] || uuid();
    req.requestId = requestId;

    return next.handle().pipe(
      tap((body) => {
        if (skip) return;
        if (!meta) return; // only audit handlers explicitly tagged via @Audit
        if (meta.manual) return; // handler emits its own audit event

        const payload: AuditEventPayload = {
          requestId,
          userId: req.user?.userId ?? req.user?.sub ?? null,
          userEmail: req.user?.email ?? null,
          action: meta.action,
          entity: meta.entity ?? null,
          entityId: body?.id ?? req.params?.id ?? null,
          before: null,
          after: meta.action === 'CREATE' ? sanitize(body) : null,
          metadata: { params: req.params, query: req.query },
          ipAddress: extractIp(req),
          userAgent: req.headers['user-agent'] ?? null,
          httpMethod: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
        };
        this.events.emit(AUDIT_EVENT, payload);
      }),
    );
  }
}

function extractIp(req: any): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

function sanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const redactKeys = ['password', 'passwordHash', 'token', 'accessToken'];
  const out: Record<string, any> = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (redactKeys.includes(k)) out[k] = '[REDACTED]';
    else if (v && typeof v === 'object') out[k] = sanitize(v);  
    else out[k] = v;
  }
  return out;
}
