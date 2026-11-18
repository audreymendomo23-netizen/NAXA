begin;
alter table public.support_agents rename column age_verified_at to age_attested_at;
comment on column public.support_agents.age_attested_at is
  'Horodatage de la déclaration de majorité recueillie par l’Administrateur ; ne constitue pas une vérification documentaire d’identité.';
commit;