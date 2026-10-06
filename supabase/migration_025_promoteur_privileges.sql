-- NAXA 025 — provisioning canonique des droits Promoteur par pharmacie
-- Additif non destructif. Le lien Promoteur/pharmacie active le socle de privilèges
-- déjà autorisé par NAXA pour la fonction Promoteur et l'architecture de la pharmacie.

create or replace function public.naxa_provision_promoteur_pharmacie(
  p_promoteur uuid,
  p_pharmacie uuid
)
returns integer
language plpgsql
security definer
set search_path=''
as $naxa$
declare
  v_arch text;
  v_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles
    where id=p_promoteur
      and role='promoteur'
      and actif
      and niveau_interne=1
  ) then
    raise exception 'Profil Promoteur invalide';
  end if;

  select architecture_code into v_arch
  from public.pharmacie_architectures
  where pharmacie_id=p_pharmacie and active;

  if v_arch is null then
    raise exception 'Architecture NAXA non définie pour la pharmacie';
  end if;

  if not exists (
    select 1 from public.promoteur_pharmacies
    where promoteur_id=p_promoteur
      and pharmacie_id=p_pharmacie
      and actif
  ) then
    raise exception 'Lien Promoteur/pharmacie inactif ou absent';
  end if;

  insert into public.naxa_profile_privileges(
    profile_id,privilege_code,pharmacie_id,scope_type,granted_by
  )
  select
    p_promoteur,
    ap.privilege_code,
    p_pharmacie,
    'PHARMACIE',
    p_promoteur
  from public.naxa_architecture_privileges ap
  join public.naxa_privileges n on n.code=ap.privilege_code
  where ap.architecture_code=v_arch
    and ap.role_key='promoteur'
    and n.active
    and not n.governance
    and n.delegable
  on conflict(profile_id,privilege_code,pharmacie_id,scope_type)
  do update set
    active=true,
    revoked_at=null,
    granted_by=excluded.granted_by,
    granted_at=now();

  get diagnostics v_count=row_count;
  return v_count;
end
$naxa$;

revoke all on function public.naxa_provision_promoteur_pharmacie(uuid,uuid)
  from public,anon,authenticated;
-- Aucun EXECUTE client : cette fonction est appelée uniquement par le trigger DB.

drop trigger if exists trg_provision_promoteur_pharmacie
  on public.promoteur_pharmacies;

create or replace function public.trg_provision_promoteur_pharmacie()
returns trigger
language plpgsql
security definer
set search_path=''
as $naxa$
begin
  if new.actif and exists (
    select 1 from public.pharmacie_architectures
    where pharmacie_id=new.pharmacie_id and active
  ) then
    perform public.naxa_provision_promoteur_pharmacie(new.promoteur_id,new.pharmacie_id);
  end if;
  return new;
end
$naxa$;

revoke all on function public.trg_provision_promoteur_pharmacie()
  from public,anon,authenticated;

create trigger trg_provision_promoteur_pharmacie
after insert or update of actif on public.promoteur_pharmacies
for each row
execute function public.trg_provision_promoteur_pharmacie();

-- Toute modification du lien réseau doit rester administrative / fonctionnelle ;
-- aucune écriture directe depuis le client.


create or replace function public.trg_provision_promoteurs_for_architecture()
returns trigger
language plpgsql
security definer
set search_path=''
as $naxa$
begin
  if new.active then
    perform public.naxa_provision_promoteur_pharmacie(pp.promoteur_id,new.pharmacie_id)
    from public.promoteur_pharmacies pp
    where pp.pharmacie_id=new.pharmacie_id
      and pp.actif;
  end if;
  return new;
end
$naxa$;

revoke all on function public.trg_provision_promoteurs_for_architecture()
  from public,anon,authenticated;

drop trigger if exists trg_provision_promoteurs_for_architecture
  on public.pharmacie_architectures;

create trigger trg_provision_promoteurs_for_architecture
after insert or update of architecture_code,active on public.pharmacie_architectures
for each row
execute function public.trg_provision_promoteurs_for_architecture();
