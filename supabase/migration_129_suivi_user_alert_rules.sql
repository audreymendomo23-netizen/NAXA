-- NAXA 129 — alertes personnelles basées uniquement sur les seuils choisis par l’utilisateur.
begin;
create table if not exists public.suivi_alert_rules(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 measurement_type text not null check(measurement_type in ('tension_systolique','tension_diastolique','frequence_cardiaque','temperature','saturation_oxygene','glycemie','poids','taille','imc','frequence_respiratoire','cholesterol_total','sommeil_heures','pas_jour','activite_minutes','hydratation_ml','douleur_score','humeur_score','cycle_jour')),
 min_value numeric(12,3),
 max_value numeric(12,3),
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(min_value is not null or max_value is not null),
 check(min_value is null or max_value is null or min_value<=max_value),
 unique(user_id,measurement_type)
);
create table if not exists public.suivi_alerts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 measurement_id uuid not null references public.suivi_measurements(id) on delete cascade,
 measurement_type text not null,
 observed_value numeric(12,3) not null,
 alert_kind text not null check(alert_kind in ('below_user_range','above_user_range')),
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create index if not exists suivi_alerts_owner_date_idx on public.suivi_alerts(user_id,created_at desc);
alter table public.suivi_alert_rules enable row level security;
alter table public.suivi_alerts enable row level security;
drop policy if exists suivi_alert_rules_self on public.suivi_alert_rules;
create policy suivi_alert_rules_self on public.suivi_alert_rules for all to authenticated
using(user_id=auth.uid() and public.is_suivi_test_account(auth.uid()))
with check(user_id=auth.uid() and public.is_suivi_test_account(auth.uid()) and public.suivi_has_consent(auth.uid(),public.suivi_measurement_family(measurement_type)));
drop policy if exists suivi_alerts_self on public.suivi_alerts;
create policy suivi_alerts_self on public.suivi_alerts for all to authenticated
using(user_id=auth.uid() and public.is_suivi_test_account(auth.uid()))
with check(user_id=auth.uid() and public.is_suivi_test_account(auth.uid()));
grant select,insert,update,delete on public.suivi_alert_rules,public.suivi_alerts to authenticated;

create or replace function public.evaluate_suivi_user_alert_rules()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.suivi_alert_rules%rowtype;
begin
 if new.value_numeric is null then return new; end if;
 for r in select * from public.suivi_alert_rules
   where user_id=new.user_id and measurement_type=new.measurement_type and enabled=true
     and public.suivi_has_consent(new.user_id,public.suivi_measurement_family(new.measurement_type))
 loop
   if r.min_value is not null and new.value_numeric<r.min_value then
     insert into public.suivi_alerts(user_id,measurement_id,measurement_type,observed_value,alert_kind)
     values(new.user_id,new.id,new.measurement_type,new.value_numeric,'below_user_range');
   elsif r.max_value is not null and new.value_numeric>r.max_value then
     insert into public.suivi_alerts(user_id,measurement_id,measurement_type,observed_value,alert_kind)
     values(new.user_id,new.id,new.measurement_type,new.value_numeric,'above_user_range');
   end if;
 end loop;
 return new;
end; $$;
revoke all on function public.evaluate_suivi_user_alert_rules() from public,anon,authenticated;
drop trigger if exists evaluate_suivi_user_alert_rules on public.suivi_measurements;
create trigger evaluate_suivi_user_alert_rules after insert on public.suivi_measurements
for each row execute function public.evaluate_suivi_user_alert_rules();
commit;
