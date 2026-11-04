-- NAXA 287 — rôles professionnels autonomes et sélection d’un espace actif.
-- Une identité Auth représente une personne. Les postes vivent dans naxa_roles
-- et sont attribués via naxa_professional_assignments. Un seul poste/espace actif
-- est sélectionné à la fois par profil. fonction_interne reste un cache legacy.
begin;

create table if not exists public.naxa_roles (
  code text primary key,
  libelle text not null,
  description text not null,
  categorie text not null check (categorie in ('SYSTEME','PROFESSIONNEL')),
  portee text not null check (portee in ('GLOBALE','RESEAU','PHARMACIE')),
  assignable boolean not null default false,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.naxa_roles(code,libelle,description,categorie,portee,assignable) values
  ('admin','Administrateur','Administration globale de la plateforme.','SYSTEME','GLOBALE',false),
  ('client','Client','Utilisateur de l’espace client.','SYSTEME','GLOBALE',false),
  ('pharmacie','Pharmacie','Espace opérationnel pharmacie historique.','SYSTEME','PHARMACIE',false),
  ('promoteur','Promoteur','Responsable du réseau et de la convention.','SYSTEME','RESEAU',false),
  ('caisse','Caisse','Poste d’encaissement et de clôture.','PROFESSIONNEL','PHARMACIE',true),
  ('responsable','Responsable','Poste de coordination déléguée dans les limites de l’architecture.','PROFESSIONNEL','PHARMACIE',true),
  ('comptable','Comptable','Poste de comptabilité et de contrôle financier.','PROFESSIONNEL','PHARMACIE',true),
  ('pharmacien','Pharmacien','Poste pharmaceutique et validation des ordonnances.','PROFESSIONNEL','PHARMACIE',true),
  ('gestionnaire_stock','Gestionnaire de stock','Poste de gestion des stocks, lots et mouvements.','PROFESSIONNEL','PHARMACIE',true),
  ('magasinier','Magasinier','Poste de gestion physique et logistique du stock.','PROFESSIONNEL','PHARMACIE',true),
  ('livreur','Livreur','Poste de livraison rattaché à une pharmacie. Les privilèges opérationnels restent à définir explicitement.','PROFESSIONNEL','PHARMACIE',true)
on conflict (code) do update set
  libelle=excluded.libelle,
  description=excluded.description,
  categorie=excluded.categorie,
  portee=excluded.portee,
  assignable=excluded.assignable,
  actif=true;

alter table public.naxa_roles enable row level security;
revoke all on public.naxa_roles from anon;
grant select on public.naxa_roles to authenticated,service_role;
drop policy if exists naxa_roles_active_read on public.naxa_roles;
create policy naxa_roles_active_read on public.naxa_roles
  for select to authenticated using (actif=true);

alter table public.naxa_professional_assignments
  add column if not exists role_code text;

update public.naxa_professional_assignments
set role_code=fonction
where role_code is null;

alter table public.naxa_professional_assignments
  alter column role_code set not null;

alter table public.naxa_professional_assignments
  drop constraint if exists naxa_professional_assignments_role_code_fkey;
alter table public.naxa_professional_assignments
  add constraint naxa_professional_assignments_role_code_fkey
  foreign key (role_code) references public.naxa_roles(code) on delete restrict;

alter table public.naxa_professional_assignments
  drop constraint if exists naxa_professional_assignments_fonction_check;
alter table public.naxa_professional_assignments
  add constraint naxa_professional_assignments_fonction_check
  check (fonction in ('caisse','gestionnaire_stock','magasinier','pharmacien','responsable','comptable','livreur'));

alter table public.profiles
  drop constraint if exists profiles_fonction_interne_check;
alter table public.profiles
  add constraint profiles_fonction_interne_check
  check (fonction_interne is null or fonction_interne in (
    'promoteur','responsable','caisse','manager_regional','chef_agence','custom',
    'pharmacien','pharmacien_assistant','gestionnaire_stock','magasinier','comptable','livreur'
  ));

alter table public.naxa_role_privileges
  drop constraint if exists naxa_role_privileges_role_key_check;
alter table public.naxa_role_privileges
  add constraint naxa_role_privileges_role_key_check
  check (role_key in ('admin','promoteur','responsable','caisse','pharmacien','preparateur','agent_accueil','comptable','gestionnaire_stock','magasinier','livreur'));

alter table public.naxa_architecture_privileges
  drop constraint if exists naxa_architecture_privileges_role_key_check;
alter table public.naxa_architecture_privileges
  add constraint naxa_architecture_privileges_role_key_check
  check (role_key in ('admin','promoteur','responsable','caisse','pharmacien','preparateur','agent_accueil','comptable','gestionnaire_stock','magasinier','livreur'));

create index if not exists naxa_professional_assignments_role_scope_idx
  on public.naxa_professional_assignments(profile_id,role_code,pharmacie_id,statut,commence_at,expire_at);

create table if not exists public.naxa_profile_active_roles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  role_code text not null references public.naxa_roles(code) on delete restrict,
  pharmacie_id uuid references public.pharmacies(id) on delete restrict,
  selected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint naxa_profile_active_roles_scope_ck check (
    (role_code in ('admin','client','promoteur') and pharmacie_id is null)
    or (role_code in ('pharmacie','caisse') and pharmacie_id is not null)
    or (role_code not in ('admin','client','promoteur','pharmacie','caisse') and pharmacie_id is not null)
  )
);
alter table public.naxa_profile_active_roles enable row level security;
revoke all on public.naxa_profile_active_roles from public,anon,authenticated;
grant all on public.naxa_profile_active_roles to service_role;

create or replace function private.naxa_sync_professional_role_alias()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.role_code is null then new.role_code:=new.fonction; end if;
  if new.fonction is null then new.fonction:=new.role_code; end if;
  if new.role_code is distinct from new.fonction then
    raise exception 'Le rôle canonique et son alias historique doivent être identiques';
  end if;
  if not exists(select 1 from public.naxa_roles r where r.code=new.role_code and r.actif and r.assignable) then
    raise exception 'Rôle professionnel inconnu ou inactif';
  end if;
  return new;
end;
$function$;

drop trigger if exists naxa_professional_role_alias_sync on public.naxa_professional_assignments;
create trigger naxa_professional_role_alias_sync
before insert or update of fonction,role_code on public.naxa_professional_assignments
for each row execute function private.naxa_sync_professional_role_alias();

create or replace function private.naxa_sync_active_professional_role()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_selected public.naxa_profile_active_roles%rowtype;
  v_next public.naxa_professional_assignments%rowtype;
begin
  if new.statut='active' and new.commence_at<=now()
     and (new.expire_at is null or new.expire_at>now())
     and exists(select 1 from public.profiles p where p.id=new.profile_id and p.actif=true) then
    select ar.* into v_selected
    from public.naxa_profile_active_roles ar
    join public.naxa_professional_assignments a
      on a.profile_id=ar.profile_id
     and a.role_code=ar.role_code
     and a.pharmacie_id=ar.pharmacie_id
     and a.statut='active'
     and a.commence_at<=now()
     and (a.expire_at is null or a.expire_at>now())
    where ar.profile_id=new.profile_id
    limit 1;

    if not found then
      insert into public.naxa_profile_active_roles(profile_id,role_code,pharmacie_id,selected_at,updated_at)
      values(new.profile_id,new.role_code,new.pharmacie_id,now(),now())
      on conflict(profile_id) do update set
        role_code=excluded.role_code,
        pharmacie_id=excluded.pharmacie_id,
        selected_at=now(),
        updated_at=now();
      update public.profiles
      set fonction_interne=new.role_code,pharmacie_id=new.pharmacie_id
      where id=new.profile_id;
    end if;
  elsif tg_op='UPDATE' and old.statut='active'
     and (new.statut<>'active' or new.commence_at>now() or (new.expire_at is not null and new.expire_at<=now())) then
    if exists(select 1 from public.naxa_profile_active_roles ar
      where ar.profile_id=old.profile_id and ar.role_code=old.role_code and ar.pharmacie_id=old.pharmacie_id) then
      select a.* into v_next
      from public.naxa_professional_assignments a
      where a.profile_id=old.profile_id
        and a.id<>new.id
        and a.statut='active'
        and a.commence_at<=now()
        and (a.expire_at is null or a.expire_at>now())
      order by a.accorde_at desc,a.created_at desc
      limit 1;
      if found then
        update public.naxa_profile_active_roles
        set role_code=v_next.role_code,pharmacie_id=v_next.pharmacie_id,selected_at=now(),updated_at=now()
        where profile_id=old.profile_id;
        update public.profiles set fonction_interne=v_next.role_code,pharmacie_id=v_next.pharmacie_id
        where id=old.profile_id;
      else
        delete from public.naxa_profile_active_roles where profile_id=old.profile_id;
        update public.profiles set fonction_interne=null
        where id=old.profile_id;
      end if;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists naxa_professional_assignment_active_role_sync on public.naxa_professional_assignments;
create trigger naxa_professional_assignment_active_role_sync
after insert or update of statut,commence_at,expire_at,role_code on public.naxa_professional_assignments
for each row execute function private.naxa_sync_active_professional_role();

-- Reprise du rôle actif historique lorsque son affectation est toujours valide.
insert into public.naxa_profile_active_roles(profile_id,role_code,pharmacie_id,selected_at,updated_at)
select distinct on (a.profile_id)
  a.profile_id,a.role_code,a.pharmacie_id,now(),now()
from public.naxa_professional_assignments a
join public.profiles p on p.id=a.profile_id and p.actif=true
where a.statut='active'
  and a.commence_at<=now()
  and (a.expire_at is null or a.expire_at>now())
order by a.profile_id,
  (a.role_code=coalesce(p.fonction_interne,case p.role::text when 'caisse' then 'caisse' else null end)) desc,
  a.accorde_at desc,a.created_at desc
on conflict(profile_id) do nothing;

update public.profiles p
set fonction_interne=ar.role_code,
    pharmacie_id=ar.pharmacie_id
from public.naxa_profile_active_roles ar
where ar.profile_id=p.id
  and exists(select 1 from public.naxa_professional_assignments a
    where a.profile_id=ar.profile_id and a.role_code=ar.role_code
      and a.pharmacie_id=ar.pharmacie_id and a.statut='active'
      and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now()));

create or replace function public.naxa_business_function(p_profile uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path=''
as $function$
  select case
    when p.role::text='admin' then 'admin'
    when exists (
      select 1
      from public.naxa_profile_active_roles ar
      where ar.profile_id=p.id
        and (
          (ar.role_code='promoteur' and p.role::text='promoteur')
          or (ar.role_code='admin' and p.role::text='admin')
          or (ar.role_code='client' and p.role::text='client')
          or (ar.role_code='pharmacie' and p.role::text='pharmacie' and ar.pharmacie_id=p.pharmacie_id)
          or (ar.role_code='caisse' and p.role::text='caisse' and ar.pharmacie_id=p.pharmacie_id)
          or exists (
            select 1 from public.naxa_professional_assignments a
            join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true
            where a.profile_id=p.id
              and a.role_code=ar.role_code
              and a.pharmacie_id=ar.pharmacie_id
              and a.statut='active'
              and a.commence_at<=now()
              and (a.expire_at is null or a.expire_at>now())
          )
        )
    ) then (
      select ar.role_code from public.naxa_profile_active_roles ar
      where ar.profile_id=p.id
      limit 1
    )
    when exists(select 1 from public.naxa_professional_assignments a where a.profile_id=p.id)
      then null
    else coalesce(
      p.fonction_interne,
      case p.role::text
        when 'promoteur' then 'promoteur'
        when 'caisse' then 'caisse'
        else null
      end
    )
  end
  from public.profiles p
  where p.id=p_profile and p.actif=true
$function$;

revoke all on function public.naxa_business_function(uuid) from public,anon;
grant execute on function public.naxa_business_function(uuid) to authenticated,service_role;

create or replace function public.naxa_select_active_role(
  p_role_code text,
  p_pharmacie_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_profile public.profiles%rowtype;
  v_role public.naxa_roles%rowtype;
  v_allowed boolean:=false;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_profile from public.profiles where id=v_uid and actif=true for update;
  if not found then raise exception 'Profil actif introuvable'; end if;

  if p_role_code is null then
    delete from public.naxa_profile_active_roles where profile_id=v_uid;
    if exists(select 1 from public.naxa_professional_assignments a where a.profile_id=v_uid) then
      update public.profiles set fonction_interne=null where id=v_uid;
    end if;
    return true;
  end if;

  select * into v_role from public.naxa_roles
  where code=p_role_code and actif=true;
  if not found then raise exception 'Rôle inconnu ou inactif'; end if;

  if p_role_code in ('admin','client','promoteur') then
    v_allowed:=v_profile.role::text=p_role_code;
    if p_role_code='promoteur' then
      v_allowed:=v_allowed and private.naxa_promoteur_valide(v_uid);
    end if;
    if p_role_code='client' and p_pharmacie_id is not null then v_allowed:=false; end if;
    if p_role_code in ('admin','promoteur') and p_pharmacie_id is not null then v_allowed:=false; end if;
  elsif p_role_code in ('pharmacie','caisse') and v_profile.role::text=p_role_code then
    v_allowed:=p_pharmacie_id is not null and p_pharmacie_id=v_profile.pharmacie_id
      and exists(select 1 from public.pharmacies ph where ph.id=p_pharmacie_id and ph.actif=true);
  else
    v_allowed:=p_pharmacie_id is not null and exists(
      select 1
      from public.naxa_professional_assignments a
      join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true
      where a.profile_id=v_uid
        and a.role_code=p_role_code
        and a.pharmacie_id=p_pharmacie_id
        and a.statut='active'
        and a.commence_at<=now()
        and (a.expire_at is null or a.expire_at>now())
    );
  end if;

  if not v_allowed then raise exception 'Ce rôle n’est pas attribué à ce compte pour cette pharmacie'; end if;

  insert into public.naxa_profile_active_roles(profile_id,role_code,pharmacie_id,selected_at,updated_at)
  values(v_uid,p_role_code,p_pharmacie_id,now(),now())
  on conflict(profile_id) do update set
    role_code=excluded.role_code,
    pharmacie_id=excluded.pharmacie_id,
    selected_at=now(),
    updated_at=now();

  update public.profiles
  set fonction_interne=case
        when p_role_code in ('admin','client','pharmacie','promoteur') then null
        else p_role_code
      end,
      pharmacie_id=coalesce(p_pharmacie_id,pharmacie_id)
  where id=v_uid;
  return true;
end;
$function$;

revoke all on function public.naxa_select_active_role(text,uuid) from public,anon;
grant execute on function public.naxa_select_active_role(text,uuid) to authenticated,service_role;

create or replace function private.naxa_scope_allows(
  p_profile uuid,
  p_pharmacie uuid,
  p_scope text default 'PHARMACIE'
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
select case
  when p_profile is null then false
  when p_scope='RESEAU' then
    public.naxa_business_function(p_profile)='promoteur'
    and private.naxa_promoteur_valide(p_profile)
    and exists(select 1 from public.promoteur_pharmacies pp
      where pp.promoteur_id=p_profile and pp.actif
        and (p_pharmacie is null or pp.pharmacie_id=p_pharmacie))
  when p_scope='PHARMACIE' then
    exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text='admin')
    or (
      public.naxa_business_function(p_profile)='promoteur'
      and private.naxa_promoteur_valide(p_profile)
      and exists(select 1 from public.promoteur_pharmacies pp
        where pp.promoteur_id=p_profile and pp.pharmacie_id=p_pharmacie and pp.actif)
    )
    or exists(
      select 1
      from public.profiles p
      join public.naxa_professional_assignments a
        on a.profile_id=p.id and a.pharmacie_id=p_pharmacie
      join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true
      where p.id=p_profile and p.actif
        and a.role_code=public.naxa_business_function(p_profile)
        and a.statut='active'
        and a.commence_at<=now()
        and (a.expire_at is null or a.expire_at>now())
    )
    or exists(
      select 1 from public.profiles p
      where p.id=p_profile and p.actif
        and p.role::text in ('pharmacie','caisse')
        and p.pharmacie_id=p_pharmacie
        and not exists(select 1 from public.naxa_professional_assignments a where a.profile_id=p.id)
    )
  when p_scope='POSTE_CAISSE' then
    public.naxa_business_function(p_profile)='caisse'
    and (
      exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.pharmacie_id=p_pharmacie)
      or exists(select 1 from public.naxa_professional_assignments a
        where a.profile_id=p_profile and a.pharmacie_id=p_pharmacie
          and a.role_code='caisse' and a.statut='active'
          and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now()))
    )
  else false
end;
$function$;

revoke all on function private.naxa_scope_allows(uuid,uuid,text) from public,anon;
grant execute on function private.naxa_scope_allows(uuid,uuid,text) to authenticated,service_role;

comment on table public.naxa_roles is
  'Catalogue canonique des rôles/postes NAXA. Les rôles sont indépendants des personnes ; les profils y sont rattachés par des affectations.';
comment on table public.naxa_profile_active_roles is
  'Sélection du seul espace actif par profil. Chaque sélection professionnelle doit correspondre à une affectation active et valide.';
comment on column public.naxa_professional_assignments.role_code is
  'Rôle canonique référencé dans naxa_roles ; fonction reste un alias de compatibilité historique.';

commit;
