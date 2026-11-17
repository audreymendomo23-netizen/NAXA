-- The table constraint must accept every scope accepted by naxa_rate_limit_v1.
alter table public.tentatives_code
  drop constraint if exists tentatives_code_scope_chk;

alter table public.tentatives_code
  add constraint tentatives_code_scope_chk
  check (scope = any (array[
    'ip_code',
    'code',
    'ip_login',
    'login_user',
    'ip_password',
    'password_user',
    'ip_password_reset'
  ]::text[]));
