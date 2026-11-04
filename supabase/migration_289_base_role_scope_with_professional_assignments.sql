-- NAXA 289 — préserver l’accès à l’espace de base quand un profil possède aussi des postes attribués.
begin;

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
        and p.pharmacie_id=p_pharmacie
        and (
          (p.role::text='pharmacie' and public.naxa_business_function(p.id)='pharmacie')
          or (p.role::text='caisse' and public.naxa_business_function(p.id)='caisse')
        )
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

commit;
