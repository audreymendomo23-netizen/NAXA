CREATE OR REPLACE FUNCTION private.naxa_business_function_base(p_profile uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    (
      select ar.role_code
      from public.naxa_profile_active_roles ar
      join public.profiles p on p.id=ar.profile_id and p.actif=true
      where ar.profile_id=p_profile
        and (
          (ar.role_code='admin' and p.role::text='admin' and ar.pharmacie_id is null)
          or (ar.role_code='client' and ar.pharmacie_id is null
              and p.username is not null and p.first_name is not null and p.last_name is not null
              and p.phone is not null and p.date_of_birth is not null
              and p.date_of_birth<=(current_date-interval '18 years')::date
              and p.age_verified=true and p.consent_accepted_at is not null)
          or (ar.role_code='promoteur' and p.role::text='promoteur'
              and ar.pharmacie_id is null and private.naxa_promoteur_valide(p.id))
          or (ar.role_code='pharmacie' and p.role::text='pharmacie'
              and ar.pharmacie_id=p.pharmacie_id
              and exists(select 1 from public.pharmacies ph where ph.id=ar.pharmacie_id and ph.actif))
          or (ar.role_code='caisse' and p.role::text='caisse'
              and ar.pharmacie_id=p.pharmacie_id
              and exists(select 1 from public.pharmacies ph where ph.id=ar.pharmacie_id and ph.actif))
          or exists(
            select 1
            from public.naxa_professional_assignments a
            join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true
            where a.profile_id=p.id
              and a.role_code=ar.role_code
              and a.pharmacie_id=ar.pharmacie_id
              and a.statut='active'
              and a.commence_at<=now()
              and (
                a.expire_at is null
                or a.expire_at>now()
                or (
                  a.role_code='livreur'
                  and exists(select 1 from public.naxa_delivery_missions m
                    where m.livreur_id=p.id and m.pharmacie_id=a.pharmacie_id
                      and m.statut in ('accepted','picked_up','arrived'))
                )
              )
          )
        )
      limit 1
    ),
    (
      select case
        when p.role::text='admin' then 'admin'
        when p.role::text='client' then 'client'
        when p.role::text='promoteur' and private.naxa_promoteur_valide(p.id) then 'promoteur'
        when p.role::text='pharmacie'
          and exists(select 1 from public.pharmacies ph where ph.id=p.pharmacie_id and ph.actif)
          then 'pharmacie'
        when p.role::text='caisse'
          and exists(select 1 from public.pharmacies ph where ph.id=p.pharmacie_id and ph.actif)
          then 'caisse'
        else null
      end
      from public.profiles p
      where p.id=p_profile and p.actif=true
    )
  )
$function$
