export const AUDIT_EVENT = 'audit.event';

export const AuditActions = {
  // Auth
  LOGIN_SUCCESS: 'AUTH.LOGIN_SUCCESS',
  LOGIN_FAILURE: 'AUTH.LOGIN_FAILURE',
  LOGOUT: 'AUTH.LOGOUT',
  REGISTER: 'AUTH.REGISTER',
  PERMISSION_CHANGE: 'AUTH.PERMISSION_CHANGE',

  // Generic CRUD
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  READ: 'READ',
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions] | string;

export interface AuditEventPayload {
  requestId?: string;
  userId?: string | null;
  userEmail?: string | null;
  action: AuditAction;
  entity?: string | null;
  entityId?: string | null;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  httpMethod?: string | null;
  url?: string | null;
  statusCode?: number | null;
}
