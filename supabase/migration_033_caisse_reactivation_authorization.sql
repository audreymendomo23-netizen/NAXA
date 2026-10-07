-- NAXA 033 — correction réactivation Caisse
-- Le moteur d'autorisation ne doit pas exiger que la cible soit active
-- pour le privilège dont la finalité est précisément de la réactiver.

create or replace function public.naxa_can(
  p_privilege text,
  p_pharmacie uuid default null,
  p_target uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  v_fn text;
  v_arch text;
  v_pharmacie uuid;
begin
  if uid is null then return false; end if;
  if p_privilege is null or not exists(select 1 from public.naxa_privileges where code=p_privilege) then return false; end if;
  select public.naxa_business_function(uid) into v_fn;
  if v_fn is null then return false; end if;
  if v_fn='admin' or exists(select 1 from public.profiles where id=uid and role::text='admin' and actif) then return true; end if;
  if v_fn='promoteur' and not public.naxa_promoteur_valide(uid) then return false; end if;
  v_pharmacie := p_pharmacie;
  if v_pharmacie is null then select pharmacie_id into v_pharmacie from public.profiles where id=uid; end if;
  if v_pharmacie is null and v_fn='promoteur' then
    if p_privilege in ('VIEW_NETWORK_PILOTAGE','VIEW_NETWORK_REPORT','VIEW_NETWORK_HEALTH','VIEW_CA_BY_PHARMACY','VIEW_COMPARISON') then return true; end if;
    return false;
  end if;
  select pa.architecture_code into v_arch from public.pharmacie_architectures pa where pa.pharmacie_id=v_pharmacie and pa.active=true;
  if v_arch is null then return false; end if;
  if not exists(select 1 from public.naxa_role_privileges rp where rp.role_key=v_fn and rp.privilege_code=p_privilege) then return false; end if;
  if not exists(select 1 from public.naxa_architecture_privileges ap where ap.architecture_code=v_arch and ap.role_key=v_fn and ap.privilege_code=p_privilege) then return false; end if;
  if not exists(select 1 from public.profile_privileges pp where pp.profile_id=uid and pp.privilege_code=p_privilege and pp.revoked_at is null) then
    if v_fn <> 'promoteur' then return false; end if;
  end if;
  if v_fn='promoteur' and v_pharmacie is not null and not exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=uid and pp.pharmacie_id=v_pharmacie and pp.actif) then return false; end if;
  if p_target is not null and v_fn='promoteur' and not exists(
    select 1 from public.profiles t
    where t.id=p_target
      and t.pharmacie_id=v_pharmacie
      and (t.actif or p_privilege='REACTIVATE_CAISSE')
  ) then return false; end if;
  return true;
end;
$$;

revoke all on function public.naxa_can(text,uuid,uuid) from public,anon;
grant execute on function public.naxa_can(text,uuid,uuid) to authenticated;
