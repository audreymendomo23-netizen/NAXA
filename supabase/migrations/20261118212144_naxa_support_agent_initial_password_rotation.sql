begin;
alter table public.support_agents
  add column if not exists must_change_password boolean not null default true;
comment on column public.support_agents.must_change_password is
  'Force le remplacement du mot de passe provisoire avant l’accès au poste Agent.';
commit;