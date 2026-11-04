-- NAXA 299 — autonomie Responsable pour les crédits et scope actif du service Comptable.
begin;

create or replace function private.naxa_actor_can_approve_marketplace_credit(p_pharmacie uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=(select auth.uid());
  v_function text;
begin
  if v_actor is null or p_pharmacie is null then return false; end if;
  if public.is_admin() then return true; end if;

  v_function:=public.naxa_business_function(v_actor);
  if v_function='promoteur' then
    return private.naxa_promoteur_valide(v_actor)
      and exists(
        select 1 from public.promoteur_pharmacies pp
        where pp.promoteur_id=v_actor
          and pp.pharmacie_id=p_pharmacie
          and pp.actif
      );
  end if;

  if v_function<>'responsable' then return false; end if;

  -- Le poste Responsable est indépendant du rôle Auth de base.
  -- La pharmacie vient de l'affectation active, et le droit d'approbation
  -- doit être explicitement délégué pour cette même pharmacie.
  return public.naxa_active_role_pharmacy(v_actor)=p_pharmacie
    and public.naxa_has_active_professional_assignment(v_actor,p_pharmacie,'responsable')
    and public.naxa_has_privilege('APPROVE_MARKETPLACE_CREDIT',p_pharmacie,'PHARMACIE')
    and exists(
      select 1
      from public.promoteur_pharmacies pp
      join public.profiles promoter on promoter.id=pp.promoteur_id
      where pp.pharmacie_id=p_pharmacie
        and pp.actif
        and promoter.actif
        and promoter.role::text='promoteur'
        and private.naxa_promoteur_valide(promoter.id)
    );
end;
$function$;
revoke all on function private.naxa_actor_can_approve_marketplace_credit(uuid) from public,anon,authenticated;
grant execute on function private.naxa_actor_can_approve_marketplace_credit(uuid) to authenticated,service_role;

create or replace function public.naxa_can_approve_marketplace_credit(p_pharmacie uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select private.naxa_actor_can_approve_marketplace_credit(p_pharmacie)
$function$;
revoke all on function public.naxa_can_approve_marketplace_credit(uuid) from public,anon;
grant execute on function public.naxa_can_approve_marketplace_credit(uuid) to authenticated,service_role;

do $patch$
declare
  v_sql text;
  v_old text;
  v_new text;
begin
  v_sql:=pg_get_functiondef('public.comptable_service_demarrer(text)'::regprocedure);
  v_old:=$old$ select pharmacie_id into p from public.profiles where id=u and actif=true;$old$;
  v_new:=$new$ p:=public.naxa_active_role_pharmacy(u);
 if public.naxa_business_function(u)<>'comptable' then p:=null; end if;$new$;
  if position(v_old in v_sql)=0 then raise exception 'Scope actif service Comptable introuvable'; end if;
  execute replace(v_sql,v_old,v_new);
end;
$patch$;

comment on function public.compta_scope_autorise(uuid) is
  'Accès au poste Comptable actif, limité à la pharmacie sélectionnée et au privilège MANAGE_ACCOUNTING.';
comment on function private.naxa_actor_can_approve_marketplace_credit(uuid) is
  'Promoteur valide du réseau ou Responsable portant une affectation active et le privilège APPROVE_MARKETPLACE_CREDIT explicitement délégué pour la pharmacie.';

commit;
