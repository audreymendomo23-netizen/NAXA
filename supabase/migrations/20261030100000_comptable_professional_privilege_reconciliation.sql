-- NAXA — réconciliation du moteur RBAC pour les fonctions professionnelles.
-- Corrige le cas Comptable : la fonction était cataloguée mais naxa_has_privilege
-- la classait à tort comme rôle personnalisé. Aucun privilège individuel n'est auto-attribué.
begin;

alter table public.naxa_role_privileges
  drop constraint if exists naxa_role_privileges_role_key_check;
alter table public.naxa_role_privileges
  add constraint naxa_role_privileges_role_key_check
  check (role_key in (
    'admin','promoteur','responsable','caisse','pharmacien','preparateur',
    'agent_accueil','comptable','gestionnaire_stock','magasinier'
  ));

alter table public.naxa_architecture_privileges
  drop constraint if exists naxa_architecture_privileges_role_key_check;
alter table public.naxa_architecture_privileges
  add constraint naxa_architecture_privileges_role_key_check
  check (role_key in (
    'admin','promoteur','responsable','caisse','pharmacien','preparateur',
    'agent_accueil','comptable','gestionnaire_stock','magasinier'
  ));

insert into public.naxa_privileges
  (code,family,description,delegable,governance_only,famille,libelle,niveau_min,niveau_max,governance,active)
values
  ('MANAGE_ACCOUNTING','FINANCE','Gérer les opérations financières autorisées avec audit',
   true,false,'FINANCE','Gérer les opérations financières autorisées avec audit',1,3,false,true)
on conflict (code) do update set
  family=excluded.family,
  description=excluded.description,
  delegable=excluded.delegable,
  governance_only=false,
  famille=excluded.famille,
  libelle=excluded.libelle,
  niveau_min=excluded.niveau_min,
  niveau_max=excluded.niveau_max,
  governance=false,
  active=true;

insert into public.naxa_role_privileges(role_key,privilege_code)
values ('comptable','MANAGE_ACCOUNTING')
on conflict do nothing;

insert into public.naxa_architecture_privileges(architecture_code,role_key,privilege_code)
select a.architecture_code,'comptable','MANAGE_ACCOUNTING'
from (values ('ORPHELIN'),('PARENTS_ENFANTS'),('PARENTS_AINES_CADETS'),('HYBRIDE')) a(architecture_code)
on conflict do nothing;

create or replace function private.naxa_has_privilege(
  p_privilege text,
  p_pharmacie uuid default null,
  p_scope text default 'PHARMACIE'
) returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  uid uuid := (select auth.uid());
  fn text;
  v_role_key text;
  arch text;
  target_pharmacy uuid := p_pharmacie;
begin
  if uid is null or p_privilege is null then return false; end if;
  if not exists (
    select 1 from public.naxa_privileges n
    where n.code=p_privilege and n.active
  ) then return false; end if;

  select public.naxa_business_function(uid) into fn;
  if fn is null then return false; end if;
  if fn='admin' then return true; end if;
  if fn='promoteur' and not private.naxa_promoteur_valide(uid) then return false; end if;
  if p_scope not in ('RESEAU','PHARMACIE','POSTE_CAISSE') then return false; end if;

  if target_pharmacy is null then
    select pharmacie_id into target_pharmacy
    from public.profiles where id=uid;
  end if;

  if p_scope='RESEAU' then
    if fn<>'promoteur' then return false; end if;
    if p_pharmacie is not null
       and not public.naxa_scope_allows(uid,p_pharmacie,'RESEAU') then
      return false;
    end if;
    return exists(
      select 1 from public.naxa_profile_privileges pp
      where pp.profile_id=uid
        and pp.privilege_code=p_privilege
        and pp.scope_type='RESEAU'
        and pp.pharmacie_id is null
        and pp.active
    );
  end if;

  if target_pharmacy is null then return false; end if;
  if not public.naxa_scope_allows(uid,target_pharmacy,p_scope) then return false; end if;
  select pa.architecture_code into arch
  from public.pharmacie_architectures pa
  where pa.pharmacie_id=target_pharmacy and pa.active;
  if arch is null then return false; end if;

  -- Les fonctions professionnelles canoniques utilisent la matrice d'architecture,
  -- et non un rôle personnalisé de pharmacie.
  v_role_key := case when fn in (
    'promoteur','responsable','caisse','pharmacien','preparateur',
    'agent_accueil','comptable','gestionnaire_stock','magasinier'
  ) then fn else null end;

  if v_role_key is not null then
    if not exists(
      select 1 from public.naxa_architecture_privileges ap
      where ap.architecture_code=arch
        and ap.role_key=v_role_key
        and ap.privilege_code=p_privilege
    ) then return false; end if;
  else
    if not exists(
      select 1 from public.profiles p
      join public.naxa_custom_roles cr
        on cr.pharmacie_id=target_pharmacy
       and cr.code=p.custom_role_code
       and cr.actif
      join public.naxa_custom_role_privileges cp
        on cp.custom_role_id=cr.id
      where p.id=uid and cp.privilege_code=p_privilege
    ) then return false; end if;
  end if;

  -- L'affectation nominative et bornée reste obligatoire.
  return exists(
    select 1 from public.naxa_profile_privileges pp
    where pp.profile_id=uid
      and pp.privilege_code=p_privilege
      and pp.pharmacie_id=target_pharmacy
      and pp.scope_type=p_scope
      and pp.active
  );
end
$function$;

revoke all on function private.naxa_has_privilege(text,uuid,text) from public,anon;
grant execute on function private.naxa_has_privilege(text,uuid,text) to authenticated,service_role;

commit;
