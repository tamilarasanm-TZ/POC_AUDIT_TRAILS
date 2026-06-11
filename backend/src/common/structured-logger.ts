import * as winston from 'winston';
import 'winston-daily-rotate-file';
import * as path from 'path';

// A standalone Winston instance used by middleware/filters when we want to
// write a structured object directly — without going through the NestJS
// Logger interface (which serializes objects to "[object Object]").

const logsDir = path.resolve(process.cwd(), 'logs');

// Format that takes whatever object we pass to .info/.warn/.error and writes
// it out as a single JSON line. Winston already adds `level` and `timestamp`
// if missing; our payloads already provide them, so the flatten step keeps
// the shape exactly as the caller wrote it.
const flatten = winston.format((info) => info)();

const fileFormat = winston.format.combine(
  flatten,
  winston.format.json(),
);

export const structuredLogger = winston.createLogger({
  // Allow everything; per-transport `level` decides what actually writes.
  level: 'debug',
  transports: [
    new winston.transports.DailyRotateFile({
      dirname: logsDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'debug',
      format: fileFormat,
    }),
    new winston.transports.DailyRotateFile({
      dirname: logsDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'warn', // warnings + errors → so 4xx/5xx land here
      format: fileFormat,
    }),
  ],
});
