-- NAXA 066 — correction additive des contraintes historiques et fermeture RLS
-- Ne modifie aucune migration existante. Cible : rejeu d'intégration/test uniquement.

begin;

-- Les migrations historiques ont laissé coexister des CHECK incompatibles :
-- la version *_ck bloque les fonctions internes autres que Responsable et
-- limite le niveau hiérarchique à 0..4, en contradiction avec le catalogue canonique.
alter table public.profiles
  drop constraint if exists profiles_fonction_interne_ck;

alter table public.profiles
  drop constraint if exists profiles_niveau_hierarchique_ck;

-- Verrouille les abonnements historiques : les abonnements Promoteur canoniques
-- sont gérés par abonnements_promoteurs/conventions_promoteurs.
alter table public.abonnements enable row level security;
drop policy if exists abonnements_admin_only on public.abonnements;
create policy abonnements_admin_only
  on public.abonnements
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.abonnements from anon, authenticated;
grant select, insert, update on public.abonnements to authenticated;

-- La table décrit les niveaux d'architecture : lecture pour utilisateurs connectés,
-- changements réservés à l'administration NAXA.
alter table public.naxa_architecture_niveaux enable row level security;
drop policy if exists naxa_architecture_niveaux_read on public.naxa_architecture_niveaux;
drop policy if exists naxa_architecture_niveaux_admin_write on public.naxa_architecture_niveaux;

create policy naxa_architecture_niveaux_read
  on public.naxa_architecture_niveaux
  for select
  to authenticated
  using (true);

create policy naxa_architecture_niveaux_admin_write
  on public.naxa_architecture_niveaux
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.naxa_architecture_niveaux from anon, authenticated;
grant select, insert, update, delete on public.naxa_architecture_niveaux to authenticated;


-- Corrige la validation du téléphone : les numéros valides ne doivent pas tomber dans le ELSE.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_username text:=lower(trim(new.raw_user_meta_data->>'username'));
  v_first_name text:=trim(new.raw_user_meta_data->>'first_name');
  v_last_name text:=trim(new.raw_user_meta_data->>'last_name');
  v_phone text:=trim(new.raw_user_meta_data->>'phone');
  v_country text:=upper(trim(new.raw_user_meta_data->>'phone_country'));
  v_dob date:=(new.raw_user_meta_data->>'date_of_birth')::date;
  v_consent boolean:=coalesce((new.raw_user_meta_data->>'consent_accepted')::boolean,false);
begin
  if v_username is null or v_username!~'^[a-z0-9][a-z0-9._-]{2,29}\Z' then raise exception 'Nom d''utilisateur invalide'; end if;
  if exists(select 1 from public.profiles where lower(username)=v_username) then raise exception 'Nom d''utilisateur déjà pris'; end if;
  if v_first_name is null or length(v_first_name)<2 or length(v_first_name)>80 then raise exception 'Prénom invalide'; end if;
  if v_last_name is null or length(v_last_name)<2 or length(v_last_name)>80 then raise exception 'Nom invalide'; end if;
  if v_dob is null or v_dob>current_date or extract(year from age(current_date,v_dob))<18 then raise exception 'NAXA est réservé aux personnes âgées de 18 ans ou plus'; end if;
  if not v_consent then raise exception 'L''acceptation des conditions est obligatoire'; end if;

  if v_country='CM' then
    if v_phone !~ '^\+237[0-9]{9}\Z' then raise exception 'Numéro de téléphone camerounais invalide'; end if;
  elsif v_country='CF' then
    if v_phone !~ '^\+236[0-9]{8}\Z' then raise exception 'Numéro de téléphone centrafricain invalide'; end if;
  elsif v_country='TD' then
    if v_phone !~ '^\+235[0-9]{8}\Z' then raise exception 'Numéro de téléphone tchadien invalide'; end if;
  elsif v_country='CG' then
    if v_phone !~ '^\+242[0-9]{9}\Z' then raise exception 'Numéro de téléphone congolais invalide'; end if;
  elsif v_country='CD' then
    if v_phone !~ '^\+243[0-9]{9}\Z' then raise exception 'Numéro de téléphone congolais (RDC) invalide'; end if;
  elsif v_country='GQ' then
    if v_phone !~ '^\+240[0-9]{9}\Z' then raise exception 'Numéro de téléphone équato-guinéen invalide'; end if;
  elsif v_country='GA' then
    if v_phone !~ '^\+241[0-9]{8}\Z' then raise exception 'Numéro de téléphone gabonais invalide'; end if;
  elsif v_country='ST' then
    if v_phone !~ '^\+239[0-9]{7}\Z' then raise exception 'Numéro de téléphone santoméen invalide'; end if;
  elsif v_country='AO' then
    if v_phone !~ '^\+244[0-9]{9}\Z' then raise exception 'Numéro de téléphone angolais invalide'; end if;
  elsif v_country='BI' then
    if v_phone !~ '^\+257[0-9]{8}\Z' then raise exception 'Numéro de téléphone burundais invalide'; end if;
  elsif v_country='RW' then
    if v_phone !~ '^\+250[0-9]{9}\Z' then raise exception 'Numéro de téléphone rwandais invalide'; end if;
  else
    raise exception 'Pays ou numéro de téléphone invalide';
  end if;

  insert into public.profiles(id,role,username,first_name,last_name,phone,phone_country,date_of_birth,age_verified,consent_accepted_at)
  values(new.id,'client',v_username,v_first_name,v_last_name,v_phone,v_country,v_dob,true,now());
  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to supabase_auth_admin;

commit;
