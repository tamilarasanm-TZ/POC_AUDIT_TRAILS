-- Make AuditLog append-only at the database layer.
-- Blocks UPDATE, DELETE, and TRUNCATE for EVERY role (including superuser).
-- The only way around this is to drop the trigger, which itself shows in DB logs.

CREATE OR REPLACE FUNCTION audit_log_no_modify()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only — % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION audit_log_no_truncate()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only — TRUNCATE is not permitted'
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_block_update ON "AuditLog";
CREATE TRIGGER audit_log_block_update
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_no_modify();

DROP TRIGGER IF EXISTS audit_log_block_delete ON "AuditLog";
CREATE TRIGGER audit_log_block_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_no_modify();

DROP TRIGGER IF EXISTS audit_log_block_truncate ON "AuditLog";
CREATE TRIGGER audit_log_block_truncate
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_no_truncate();
