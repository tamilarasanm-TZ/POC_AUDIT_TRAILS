// Centralized log-payload shapes for application + error logs.
// Everything written to logs/app-*.log / logs/error-*.log uses these.

export const SERVICE_NAME = process.env.SERVICE_NAME ?? 'audit-trails-service';

export interface AppLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'DEBUG';
  service: string;
  module: string;          // e.g. 'Ledger', 'Orders', 'Auth'
  action: string;          // e.g. 'CREATE_LEDGER', 'UPDATE_ORDER', 'LOGIN'
  requestId: string | null;
  userId: string | null;
  method: string;
  url: string;
  ip: string | null;
  statusCode: number;
  durationMs: number;
  message: string;
}

export interface ErrorLog {
  timestamp: string;
  level: 'ERROR';
  service: string;
  module: string;
  requestId: string | null;
  userId: string | null;
  errorCode: string;       // e.g. 'AUTH_001', 'ORDERS_404'
  errorMessage: string;
  stackTrace: string | null;
  ip: string | null;
  // Useful extras
  method?: string;
  url?: string;
  statusCode?: number;
}

// Map HTTP status code → semantic action + module guess based on URL pattern.
export function deriveModuleAndAction(
  method: string,
  url: string,
  statusCode: number,
): { module: string; action: string; message: string } {
  // /auth/login, /auth/logout, etc.
  if (url.startsWith('/auth')) {
    const op = url.split('/')[2] ?? 'AUTH';
    const upper = op.toUpperCase();
    return {
      module: 'Auth',
      action: upper,
      message:
        statusCode >= 400
          ? `${upper} failed`
          : `${upper} succeeded`,
    };
  }

  // /orders, /orders/:id, /users, /users/:id
  const segments = url.replace(/^\/+/, '').split('/');
  const resource = segments[0] ?? 'unknown';
  const moduleName = resource.charAt(0).toUpperCase() + resource.slice(1, -1) || resource;

  let verb: string;
  switch (method) {
    case 'POST':   verb = 'CREATE'; break;
    case 'PATCH':
    case 'PUT':    verb = 'UPDATE'; break;
    case 'DELETE': verb = 'DELETE'; break;
    case 'GET':    verb = 'READ';   break;
    default:       verb = method.toUpperCase();
  }

  const upperResource = resource.toUpperCase().replace(/S$/, '');
  return {
    module: moduleName,
    action: `${verb}_${upperResource}`,
    message:
      statusCode >= 500 ? `${verb} ${moduleName} failed (server error)` :
      statusCode >= 400 ? `${verb} ${moduleName} rejected (${statusCode})` :
                          `${verb} ${moduleName} succeeded`,
  };
}

// Map status / class to a stable error code.
// In real systems this should be a curated catalogue rather than derived.
export function deriveErrorCode(
  module: string,
  statusCode: number,
  exceptionName?: string,
): string {
  if (statusCode === 401) return 'AUTH_001';
  if (statusCode === 403) return 'AUTH_002';
  if (statusCode === 404) return `${module.toUpperCase()}_404`;
  if (statusCode === 409) return `${module.toUpperCase()}_409`;
  if (statusCode >= 500) return `${module.toUpperCase()}_500`;
  if (exceptionName) return `${module.toUpperCase()}_${exceptionName.replace(/Exception$/, '').toUpperCase()}`;
  return `${module.toUpperCase()}_${statusCode}`;
}
