-- NAXA Comptable — corrige le contrôle de privilège sans cible individuelle.
-- naxa_can réserve p_target=NULL aux privilèges VIEW_* ; MANAGE_ACCOUNTING
-- est un privilège de fonction sur la pharmacie et doit passer par le helper RBAC.
begin;

create or replace function public.compta_scope_autorise(p_pharmacie uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select auth.uid() is not null
    and p_pharmacie is not null
    and public.naxa_business_function(auth.uid())='comptable'
    and public.naxa_scope_allows(auth.uid(),p_pharmacie,'PHARMACIE')
    and private.naxa_has_privilege('MANAGE_ACCOUNTING',p_pharmacie,'PHARMACIE')
$function$;

revoke all on function public.compta_scope_autorise(uuid) from public,anon;
grant execute on function public.compta_scope_autorise(uuid) to authenticated,service_role;

comment on function public.compta_scope_autorise(uuid) is
  'Vérifie la fonction Comptable, le périmètre pharmacie et le privilège MANAGE_ACCOUNTING nominatif via le moteur RBAC.';

commit;
