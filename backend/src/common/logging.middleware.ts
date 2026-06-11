import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import {
  AppLog,
  SERVICE_NAME,
  deriveModuleAndAction,
} from './log-shapes';
import { getRequestContext } from '../audit/request-context';
import { structuredLogger } from './structured-logger';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
      // 5xx is handled by StructuredExceptionFilter to avoid duplicate rows.
      if (res.statusCode >= 500) return;

      const ctx = getRequestContext();
      const status = res.statusCode;
      const { module, action, message } = deriveModuleAndAction(method, originalUrl, status);

      const level: AppLog['level'] = status >= 400 ? 'WARN' : 'INFO';

      const entry: AppLog = {
        timestamp: new Date().toISOString(),
        level,
        service: SERVICE_NAME,
        module,
        action,
        requestId: ctx?.requestId ?? null,
        userId: ctx?.actorId ?? null,
        method,
        url: originalUrl,
        ip: ctx?.ip ?? null,
        statusCode: status,
        durationMs: Date.now() - start,
        message,
      };

      // Bypass NestJS Logger — go straight to Winston so the structured
      // object lands in the file as a real JSON line (not "[object Object]").
      if (level === 'WARN') structuredLogger.warn(entry);
      else structuredLogger.info(entry);
    });

    next();
  }
}
