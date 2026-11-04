-- NAXA 266 — faire respecter les affectations multi-pharmacies dans le contrôle public de périmètre.
-- Le moteur naxa_has_privilege et les politiques applicatives utilisent cette façade publique.
begin;

create or replace function public.naxa_scope_allows(
  p_actor uuid,
  p_pharmacie uuid,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  with recursive ancestors(id,parent_profile_id,role,actif,depth) as (
    select p.id,p.parent_profile_id,p.role::text,p.actif,0
    from public.profiles p
    where p.id=p_actor

    union all

    select parent.id,parent.parent_profile_id,parent.role::text,parent.actif,a.depth+1
    from ancestors a
    join public.profiles parent on parent.id=a.parent_profile_id
    where a.depth < 3
  )
  select case
    when p_actor is null then false

    when p_scope='RESEAU' then
      exists (
        select 1
        from public.profiles p
        where p.id=p_actor
          and p.role::text='promoteur'
          and p.actif
          and private.naxa_promoteur_valide(p.id)
      )
      and (
        p_pharmacie is null
        or exists (
          select 1
          from public.promoteur_pharmacies pp
          where pp.promoteur_id=p_actor
            and pp.pharmacie_id=p_pharmacie
            and pp.actif
        )
      )

    when p_scope='PHARMACIE' then
      p_pharmacie is not null
      and (
        exists (
          select 1
          from public.profiles p
          join public.promoteur_pharmacies pp
            on pp.promoteur_id=p.id
           and pp.pharmacie_id=p_pharmacie
           and pp.actif
          where p.id=p_actor
            and p.role::text='promoteur'
            and p.actif
            and private.naxa_promoteur_valide(p.id)
        )
        or (
          exists (
            select 1
            from public.profiles actor
            where actor.id=p_actor
              and actor.actif
              and actor.role::text in ('pharmacie','caisse')
              and (
                actor.pharmacie_id=p_pharmacie
                or exists (
                  select 1
                  from public.naxa_professional_assignments assignment
                  where assignment.profile_id=actor.id
                    and assignment.pharmacie_id=p_pharmacie
                    and assignment.statut='active'
                    and assignment.commence_at<=now()
                    and (assignment.expire_at is null or assignment.expire_at>now())
                )
              )
          )
          and exists (
            select 1
            from ancestors a
            join public.promoteur_pharmacies pp
              on pp.promoteur_id=a.id
             and pp.pharmacie_id=p_pharmacie
             and pp.actif
            where a.role='promoteur'
              and a.actif
              and private.naxa_promoteur_valide(a.id)
          )
        )
      )

    when p_scope='POSTE_CAISSE' then
      p_pharmacie is not null
      and exists (
        select 1
        from public.profiles actor
        where actor.id=p_actor
          and actor.role::text='caisse'
          and actor.actif
          and (
            actor.pharmacie_id=p_pharmacie
            or exists (
              select 1
              from public.naxa_professional_assignments assignment
              where assignment.profile_id=actor.id
                and assignment.pharmacie_id=p_pharmacie
                and assignment.fonction='caisse'
                and assignment.statut='active'
                and assignment.commence_at<=now()
                and (assignment.expire_at is null or assignment.expire_at>now())
            )
          )
      )
      and exists (
        select 1
        from ancestors a
        join public.promoteur_pharmacies pp
          on pp.promoteur_id=a.id
         and pp.pharmacie_id=p_pharmacie
         and pp.actif
        where a.role='promoteur'
          and a.actif
          and private.naxa_promoteur_valide(a.id)
      )
    else false
  end;
$function$;

revoke all on function public.naxa_scope_allows(uuid,uuid,text) from public,anon;
grant execute on function public.naxa_scope_allows(uuid,uuid,text) to authenticated,service_role;

comment on function public.naxa_scope_allows(uuid,uuid,text) is
  'Contrôle le périmètre réseau/pharmacie/poste : les fonctions professionnelles actives peuvent couvrir plusieurs pharmacies du réseau Promoteur, avec expiration automatique ou permanence jusqu’à révocation.';

commit;
