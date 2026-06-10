// Central policy for the Prisma extension. Edit ONE file to enroll a new
// entity, change redaction, or change emitted actions.

export const AUDITED_MODELS = new Set<string>([
  'User',
  'Order',
]);

// Per-model sensitive fields. Replaced with '[REDACTED]' in before/after.
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  User: ['passwordHash'],
  // Order: ['someSensitiveField'],
};

export function isAudited(model: string | undefined): boolean {
  return !!model && AUDITED_MODELS.has(model);
}

export function redactRow<T extends Record<string, any> | null | undefined>(
  model: string,
  row: T,
): T {
  if (!row || typeof row !== 'object') return row;
  const fields = SENSITIVE_FIELDS[model];
  if (!fields || fields.length === 0) return row;
  const clone: Record<string, any> = { ...row };
  for (const f of fields) {
    if (f in clone) clone[f] = '[REDACTED]';
  }
  return clone as T;
}
