begin;

-- All 276 current public tables are owned by postgres. Anonymous clients have
-- no INSERT/UPDATE/DELETE/ALL RLS policy in public, so remove direct DML.
revoke insert, update, delete, truncate, references, trigger, maintain
  on all tables in schema public from anon;

-- Authenticated users keep application DML, governed by RLS, but not
-- schema-maintenance privileges on application tables.
revoke truncate, references, trigger, maintain
  on all tables in schema public from authenticated;

-- Close the default-ACL source for future tables created by postgres.
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger, maintain
  on tables from anon;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain
  on tables from authenticated;

commit;
