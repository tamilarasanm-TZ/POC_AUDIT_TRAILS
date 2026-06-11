import { WinstonModuleOptions, utilities as nestUtils } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import * as path from 'path';

// Logs go to:
//   - logs/app-YYYY-MM-DD.log   (all levels)
//   - logs/error-YYYY-MM-DD.log (errors only)
//   - terminal (colorized, dev only)
//
// Each file rotates daily, keeps 14 days, max 20MB per file.

const logsDir = path.resolve(process.cwd(), 'logs');

// When middleware / filters call logger.log(obj) with a structured payload,
// Winston puts the object under the `message` key. This format detects that
// case and "lifts" the inner fields up so the JSON line matches the shape
// produced by the middleware/filter directly.
const flattenStructured = winston.format((info) => {
  const msg: any = (info as any).message;
  if (msg && typeof msg === 'object' && !Array.isArray(msg)) {
    // Preserve everything from the structured payload, falling back to
    // Winston's own timestamp/level if the payload didn't set them.
    return { ...info, ...msg };
  }
  return info;
})();

const fileFormat = winston.format.combine(
  flattenStructured,
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const loggerOptions: WinstonModuleOptions = {
  transports: [
    // Pretty colorized output for the terminal (dev only).
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.ms(),
        nestUtils.format.nestLike('AuditTrails', {
          colors: true,
          prettyPrint: true,
        }),
      ),
    }),

    // Daily-rotated combined log (all levels, JSON for grep/jq).
    new winston.transports.DailyRotateFile({
      dirname: logsDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'debug',
      format: fileFormat,
    }),

    // Daily-rotated error-only log for quick incident review.
    new winston.transports.DailyRotateFile({
      dirname: logsDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: fileFormat,
    }),
  ],
};
