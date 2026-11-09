-- Two active privilege FK columns are not covered by the existing
-- composite primary keys because privilege_code is not the leading column.
CREATE INDEX IF NOT EXISTS idx_naxa_architecture_privileges_privilege_code
  ON public.naxa_architecture_privileges USING btree (privilege_code);

CREATE INDEX IF NOT EXISTS idx_naxa_role_privileges_privilege_code
  ON public.naxa_role_privileges USING btree (privilege_code);
