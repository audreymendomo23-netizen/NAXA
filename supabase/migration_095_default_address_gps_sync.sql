-- NAXA 095 — synchronisation sécurisée de l’adresse par défaut et des coordonnées GPS.
begin;
alter table public.client_preferences
  add column if not exists ville_defaut text check (ville_defaut is null or char_length(ville_defaut)<=80),
  add column if not exists repere_defaut text check (repere_defaut is null or char_length(repere_defaut)<=200),
  add column if not exists latitude_defaut double precision,
  add column if not exists longitude_defaut double precision;
do $constraints$
begin
  if not exists(select 1 from pg_constraint where conname='client_preferences_latitude_defaut_check') then
    alter table public.client_preferences add constraint client_preferences_latitude_defaut_check check(latitude_defaut is null or latitude_defaut between -90 and 90);
  end if;
  if not exists(select 1 from pg_constraint where conname='client_preferences_longitude_defaut_check') then
    alter table public.client_preferences add constraint client_preferences_longitude_defaut_check check(longitude_defaut is null or longitude_defaut between -180 and 180);
  end if;
end;
$constraints$;
commit;
