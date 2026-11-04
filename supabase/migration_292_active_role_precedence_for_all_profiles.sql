-- NAXA 292 — respecter le choix d’espace actif, y compris pour un profil Admin.
begin;

create or replace function public.naxa_business_function(p_profile uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path=''
as $function$
  select case
    when exists (
      select 1
      from public.naxa_profile_active_roles ar
      where ar.profile_id=p.id
        and (
          (ar.role_code='promoteur'
            and p.role::text='promoteur'
            and private.naxa_promoteur_valide(p.id))
          or (ar.role_code='admin' and p.role::text='admin')
          or (ar.role_code='client' and p.role::text='client')
          or (ar.role_code='pharmacie'
            and p.role::text='pharmacie'
            and ar.pharmacie_id=p.pharmacie_id)
          or (ar.role_code='caisse'
            and p.role::text='caisse'
            and ar.pharmacie_id=p.pharmacie_id)
          or exists (
            select 1
            from public.naxa_professional_assignments a
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
      select ar.role_code
      from public.naxa_profile_active_roles ar
      where ar.profile_id=p.id
      limit 1
    )
    when exists(
      select 1 from public.naxa_professional_assignments a
      where a.profile_id=p.id
    ) then null
    else coalesce(
      p.fonction_interne,
      case p.role::text
        when 'admin' then 'admin'
        when 'client' then 'client'
        when 'pharmacie' then 'pharmacie'
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

commit;
