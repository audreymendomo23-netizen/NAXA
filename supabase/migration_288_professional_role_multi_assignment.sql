-- NAXA 288 — rendre l’affectation professionnelle multi-postes et inclure le poste Livreur.
-- Le contrôle porte sur le Promoteur, la pharmacie, le privilège et la cible active.
-- La cible peut déjà occuper un autre poste : les affectations sont cumulables.
begin;

create or replace function public.naxa_grant_professional_assignment(
  p_target uuid,
  p_pharmacie uuid,
  p_fonction text,
  p_commence_at timestamptz,
  p_expire_at timestamptz,
  p_motif text
) returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_id uuid;
  v_arch text;
  v_nature text;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_target is null or p_pharmacie is null or p_target=v_actor then
    raise exception 'Cible ou pharmacie invalide';
  end if;
  if not exists(
    select 1 from public.naxa_roles r
    where r.code=p_fonction and r.actif and r.assignable
      and r.portee='PHARMACIE'
  ) then
    raise exception 'Rôle professionnel non attribuable';
  end if;
  if p_commence_at is null or p_commence_at>now()+interval '1 minute'
     or (p_expire_at is not null and p_expire_at<=greatest(p_commence_at,now())) then
    raise exception 'Période d’affectation invalide';
  end if;
  if p_motif is null or length(trim(p_motif))<5 or length(trim(p_motif))>500 then
    raise exception 'Motif obligatoire (5 à 500 caractères)';
  end if;

  if not exists(
    select 1 from public.profiles p
    join public.promoteur_pharmacies pp on pp.promoteur_id=p.id
    join public.pharmacies ph on ph.id=pp.pharmacie_id
    where p.id=v_actor
      and p.role::text='promoteur'
      and p.actif=true
      and pp.pharmacie_id=p_pharmacie
      and pp.actif=true
      and ph.actif=true
      and private.naxa_promoteur_valide(v_actor)
  ) then
    raise exception 'Pharmacie hors réseau Promoteur ou inactive';
  end if;

  if not public.naxa_has_privilege('ASSIGN_USER_TO_PHARMACY',p_pharmacie,'PHARMACIE') then
    raise exception 'Privilège ASSIGN_USER_TO_PHARMACY absent';
  end if;

  if not exists(select 1 from public.profiles p where p.id=p_target and p.actif=true) then
    raise exception 'Le compte cible doit être actif';
  end if;

  select architecture_code into v_arch
  from public.pharmacie_architectures
  where pharmacie_id=p_pharmacie and active=true;
  if v_arch is null then raise exception 'Architecture non définie'; end if;
  if p_fonction='responsable' and v_arch not in ('PARENTS_AINES_CADETS','HYBRIDE') then
    raise exception 'Cette architecture ne permet pas de Responsable';
  end if;

  v_nature:=case when p_expire_at is null then 'ordinaire' else 'urgence' end;

  if exists(
    select 1 from public.naxa_professional_assignments a
    where a.profile_id=p_target
      and a.pharmacie_id=p_pharmacie
      and a.role_code=p_fonction
      and a.statut='active'
      and (a.expire_at is null or a.expire_at>p_commence_at)
      and (p_expire_at is null or a.commence_at<p_expire_at)
  ) then
    raise exception 'Une affectation active de ce rôle chevauche déjà la période';
  end if;

  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par
  ) values(
    p_target,p_pharmacie,p_fonction,p_fonction,'active',v_nature,trim(p_motif),
    p_commence_at,p_expire_at,v_actor
  ) returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text) to authenticated;

commit;
