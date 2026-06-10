import { SetMetadata } from '@nestjs/common';

export const AUDIT_META = 'audit:meta';

export interface AuditMeta {
  action: string;
  entity?: string;
  // when true, the interceptor will skip auto-audit (handler emits its own)
  manual?: boolean;
}

export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_META, meta);

export const SKIP_AUDIT = 'audit:skip';
export const SkipAudit = () => SetMetadata(SKIP_AUDIT, true);
