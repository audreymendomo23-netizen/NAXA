begin;

-- Anonymous clients may read only rows explicitly exposed by SELECT grants + RLS.
-- No anonymous DML policy exists in public; remove the inherited DML surface.
revoke insert, update, delete, truncate, references, trigger, maintain
  on all tables in schema public from anon;

-- Authenticated users keep application DML, which remains governed by RLS,
-- but must never receive schema-maintenance privileges on application tables.
revoke truncate, references, trigger, maintain
  on all tables in schema public from authenticated;

-- Prevent the broad Supabase/Postgres default ACL from reappearing on new tables.
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger, maintain
  on tables from anon;
alter default privileges for role supabase_admin in schema public
  revoke insert, update, delete, truncate, references, trigger, maintain
  on tables from anon;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain
  on tables from authenticated;
alter default privileges for role supabase_admin in schema public
  revoke truncate, references, trigger, maintain
  on tables from authenticated;

commit;
