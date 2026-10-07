-- NAXA 026 — scope Promoteur canonique
-- Façade publique canonique du scope ; aucune dépendance à un schéma privé absent du socle historique.
create or replace function public.naxa_scope_allows(p_profile uuid,p_pharmacie uuid,p_scope text default 'PHARMACIE')
returns boolean language sql stable security definer set search_path=''
as $fn$
  select case
    when p_profile is null then false
    when p_scope='RESEAU' then exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text='promoteur')
      and exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=p_profile and pp.actif and (p_pharmacie is null or pp.pharmacie_id=p_pharmacie))
    when p_scope='PHARMACIE' then exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text='admin')
      or exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text='promoteur' and exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=p_profile and pp.pharmacie_id=p_pharmacie and pp.actif))
      or exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text<>'promoteur' and p.pharmacie_id=p_pharmacie)
    when p_scope='POSTE_CAISSE' then exists(select 1 from public.profiles p where p.id=p_profile and p.actif and (p.role::text='admin' or p.role::text='caisse') and (p.role::text='admin' or p.pharmacie_id=p_pharmacie))
    else false
  end
$fn$;
revoke all on function public.naxa_scope_allows(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.naxa_scope_allows(uuid,uuid,text) to authenticated;
