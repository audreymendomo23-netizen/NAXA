-- NAXA 041b — borner un privilège RESEAU lorsqu'une pharmacie cible est fournie.
-- La version historique vérifie le droit RESEAU mais ignore p_pharmacie, ce qui
-- permet de retourner true pour une pharmacie hors périmètre du Promoteur.
create or replace function private.naxa_has_privilege(
  p_privilege text,
  p_pharmacie uuid default null,
  p_scope text default 'PHARMACIE'
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  uid uuid := (select auth.uid());
  fn text;
  v_role_key text;
  arch text;
  target_pharmacy uuid := p_pharmacie;
begin
  if uid is null or p_privilege is null then return false; end if;
  if not exists(select 1 from public.naxa_privileges n where n.code=p_privilege and n.active) then return false; end if;
  select public.naxa_business_function(uid) into fn;
  if fn is null then return false; end if;
  if fn='admin' then return true; end if;
  if fn='promoteur' and not private.naxa_promoteur_valide(uid) then return false; end if;
  if p_scope not in ('RESEAU','PHARMACIE','POSTE_CAISSE') then return false; end if;
  if target_pharmacy is null then
    select pharmacie_id into target_pharmacy from public.profiles where id=uid;
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

  v_role_key:=case when fn in ('promoteur','responsable','caisse') then fn else null end;
  if v_role_key is not null then
    if not exists(
      select 1 from public.naxa_architecture_privileges ap
      where ap.architecture_code=arch and ap.role_key=v_role_key and ap.privilege_code=p_privilege
    ) then return false; end if;
  else
    if not exists(
      select 1 from public.profiles p
      join public.naxa_custom_roles cr on cr.pharmacie_id=target_pharmacy and cr.code=p.custom_role_code and cr.actif
      join public.naxa_custom_role_privileges cp on cp.custom_role_id=cr.id
      where p.id=uid and cp.privilege_code=p_privilege
    ) then return false; end if;
  end if;

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
