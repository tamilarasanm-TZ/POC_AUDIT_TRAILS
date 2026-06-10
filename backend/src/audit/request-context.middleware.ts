import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { runWithRequestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId =
      (req.headers['x-request-id'] as string) || uuid();
    (req as any).requestId = requestId;

    const ctx = {
      requestId,
      ip: extractIp(req),
      ua: req.headers['user-agent'] ?? null,
      method: req.method,
      url: req.originalUrl,
      // actorId / actorEmail filled in later by the JWT auth layer
      actorId: null,
      actorEmail: null,
    };

    runWithRequestContext(ctx, () => next());
  }
}

function extractIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? null;
}
