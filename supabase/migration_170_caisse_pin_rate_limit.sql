-- NAXA 170 — limiter les tentatives de PIN de décaissement.
begin;
alter table public.caisse_security_credentials add column if not exists pin_failed_attempts integer not null default 0;
alter table public.caisse_security_credentials add column if not exists pin_locked_until timestamptz;
alter table public.caisse_security_credentials drop constraint if exists caisse_security_pin_attempts_ck;
alter table public.caisse_security_credentials add constraint caisse_security_pin_attempts_ck check(pin_failed_attempts between 0 and 5);
commit;
