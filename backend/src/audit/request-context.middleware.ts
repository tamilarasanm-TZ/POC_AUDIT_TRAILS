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
  if (typeof fwd === 'string') return normalizeIp(fwd.split(',')[0].trim());
  return normalizeIp(req.ip ?? req.socket?.remoteAddress ?? null);
}

// Convert IPv6 loopback / IPv4-mapped addresses to plain IPv4 for readability.
// '::1'              → '127.0.0.1'
// '::ffff:192.0.2.5' → '192.0.2.5'
function normalizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip === '::1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}
