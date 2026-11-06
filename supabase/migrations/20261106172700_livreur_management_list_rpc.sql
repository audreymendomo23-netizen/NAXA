-- NAXA — liste de gestion des Livreurs, cloisonnée au réseau/pharmacie active.
begin;

create or replace function public.naxa_livreurs_management_list(p_pharmacies uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_pharmacy uuid;
  v_count integer;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_pharmacies is null or cardinality(p_pharmacies)<1 or cardinality(p_pharmacies)>100 then
    raise exception 'Périmètre pharmacie invalide';
  end if;
  if exists(select 1 from unnest(p_pharmacies) x where x is null) then
    raise exception 'Périmètre pharmacie invalide';
  end if;
  v_role:=public.naxa_business_function(v_uid);

  if v_role='promoteur' then
    if not private.naxa_promoteur_valide(v_uid) then
      raise exception 'Compte Promoteur inactif ou invalide';
    end if;
    if exists(
      select 1 from unnest(p_pharmacies) x(pharmacy_id)
      where not exists(
        select 1 from public.promoteur_pharmacies pp
        join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
        where pp.promoteur_id=v_uid and pp.pharmacie_id=x.pharmacy_id and pp.actif
      )
    ) then raise exception 'Une pharmacie demandée est hors du réseau Promoteur'; end if;
    if exists(
      select 1 from unnest(p_pharmacies) x(pharmacy_id)
      where not public.naxa_has_privilege('ASSIGN_USER_TO_PHARMACY',x.pharmacy_id,'PHARMACIE')
    ) then raise exception 'Privilège de gestion de l’équipe absent'; end if;
  elsif v_role='pharmacie' then
    v_pharmacy:=public.naxa_active_role_pharmacy(v_uid);
    if cardinality(p_pharmacies)<>1 or p_pharmacies[1] is distinct from v_pharmacy
      or not public.naxa_scope_allows(v_uid,v_pharmacy,'PHARMACIE')
      or not exists(select 1 from public.pharmacies ph where ph.id=v_pharmacy and ph.actif=true and ph.archivee_le is null) then
      raise exception 'Une Pharmacie ne peut consulter que ses propres Livreurs';
    end if;
  elsif public.is_admin() then
    if exists(select 1 from unnest(p_pharmacies) x(pharmacy_id)
      where not exists(select 1 from public.pharmacies ph where ph.id=x.pharmacy_id and ph.actif=true and ph.archivee_le is null)) then
      raise exception 'Une pharmacie demandée est inactive';
    end if;
  else
    raise exception 'Gestion des Livreurs réservée au Promoteur, à la Pharmacie ou à l’Admin';
  end if;

  select count(*) into v_count from (
    select distinct x as pharmacy_id from unnest(p_pharmacies) x
  ) distinct_pharmacies;
  if v_count<>cardinality(p_pharmacies) then
    raise exception 'Le périmètre contient des pharmacies en double';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id',a.id,
    'profile_id',a.profile_id,
    'pharmacie_id',a.pharmacie_id,
    'fonction',a.fonction,
    'statut',a.statut,
    'nature_affectation',a.nature_affectation,
    'motif',a.motif,
    'commence_at',a.commence_at,
    'expire_at',a.expire_at,
    'accorde_at',a.accorde_at,
    'revoque_at',a.revoque_at,
    'motif_revocation',a.motif_revocation,
    'profile_active',p.actif,
    'first_name',p.first_name,
    'last_name',p.last_name,
    'username',p.username
  ) order by a.accorde_at desc,a.created_at desc),'[]'::jsonb)
  into v_result
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id
  where a.role_code='livreur'
    and a.pharmacie_id=any(p_pharmacies);

  return v_result;
end;
$function$;
revoke all on function public.naxa_livreurs_management_list(uuid[]) from public,anon;
grant execute on function public.naxa_livreurs_management_list(uuid[]) to authenticated;

commit;
