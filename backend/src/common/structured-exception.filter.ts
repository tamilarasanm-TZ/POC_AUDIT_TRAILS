import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ErrorLog,
  SERVICE_NAME,
  deriveErrorCode,
  deriveModuleAndAction,
} from './log-shapes';
import { getRequestContext } from '../audit/request-context';
import { structuredLogger } from './structured-logger';

@Catch()
export class StructuredExceptionFilter implements ExceptionFilter {

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpCtx = host.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? (exception as HttpException).getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const errMessage =
      exception instanceof Error
        ? exception.message
        : typeof exception === 'string'
        ? exception
        : 'Unknown error';

    const stack =
      exception instanceof Error && exception.stack ? exception.stack : null;

    const exceptionName =
      exception instanceof Error ? exception.constructor.name : undefined;

    const ctx = getRequestContext();
    const { module } = deriveModuleAndAction(req.method, req.originalUrl, status);
    const errorCode = deriveErrorCode(module, status, exceptionName);

    const entry: ErrorLog = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      service: SERVICE_NAME,
      module,
      requestId: ctx?.requestId ?? null,
      userId: ctx?.actorId ?? null,
      errorCode,
      errorMessage: errMessage,
      stackTrace: stack,
      ip: ctx?.ip ?? null,
      method: req.method,
      url: req.originalUrl,
      statusCode: status,
    };

    // Bypass NestJS Logger — write the structured object straight to Winston
    // so the JSON shape is preserved in app-*.log + error-*.log.
    structuredLogger.error(entry);

    // Send the HTTP response in the standard NestJS shape so frontend behaviour
    // doesn't change.
    const body = isHttp
      ? (exception as HttpException).getResponse()
      : { statusCode: status, message: 'Internal server error', errorCode };

    res.status(status).json(
      typeof body === 'string' ? { statusCode: status, message: body, errorCode } : { ...((body as object) ?? {}), errorCode },
    );
  }
}
