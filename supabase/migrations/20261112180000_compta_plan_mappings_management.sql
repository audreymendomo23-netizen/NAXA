-- NAXA — gestion sécurisée du plan comptable et des mappings.
begin;

create or replace function public.compta_plan_lister_pharmacies()
returns table(pharmacie_id uuid, pharmacie_nom text)
language plpgsql stable security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_role text;
begin
  if v_uid is null then raise exception 'Authentification requise' using errcode='42501'; end if;
  v_role:=private.naxa_business_function(v_uid);
  if v_role='promoteur' and private.naxa_promoteur_valide(v_uid) then
    return query
      select ph.id,ph.nom::text
      from public.promoteur_pharmacies pp
      join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif
      where pp.promoteur_id=v_uid and pp.actif
      order by ph.nom;
  elsif v_role='comptable' then
    return query
      select ph.id,ph.nom::text from public.pharmacies ph
      where ph.id=private.naxa_active_role_pharmacy(v_uid)
        and public.compta_scope_autorise(ph.id);
  else
    raise exception 'Accès réservé au Promoteur ou Comptable' using errcode='42501';
  end if;
end $$;

create or replace function public.compta_plan_lire(p_pharmacie uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_role text; v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentification requise' using errcode='42501'; end if;
  v_role:=private.naxa_business_function(v_uid);
  if not private.naxa_scope_allows(v_uid,p_pharmacie,'PHARMACIE')
     or not (
       (v_role='promoteur' and private.naxa_promoteur_valide(v_uid))
       or (v_role='comptable' and public.compta_scope_autorise(p_pharmacie))
     ) then
    raise exception 'Pharmacie hors périmètre comptable' using errcode='42501';
  end if;
  select jsonb_build_object(
    'comptes',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'code',c.code,'libelle',c.libelle,'classe',c.classe,'statut',c.statut,
      'source_validation',c.source_validation,'valide_le',c.valide_le
    ) order by c.code) from public.compta_plan_comptable c where c.pharmacie_id=p_pharmacie),'[]'::jsonb),
    'mappings',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'evenement_type',m.evenement_type,'sens',m.sens,'compte_id',m.compte_id,
      'compte_code',c.code,'compte_libelle',c.libelle,'statut',m.statut,
      'valide_du',m.valide_du,'valide_jusquau',m.valide_jusquau
    ) order by m.evenement_type,m.sens) from public.compta_mapping_compte m
      left join public.compta_plan_comptable c on c.id=m.compte_id and c.pharmacie_id=m.pharmacie_id
      where m.pharmacie_id=p_pharmacie),'[]'::jsonb),
    'ecriture_autorisee',public.compta_ecriture_autorisee(p_pharmacie),
    'pharmacie_id',p_pharmacie
  ) into v_result;
  return v_result;
end $$;

create or replace function public.compta_plan_enregistrer_compte(
  p_pharmacie uuid,p_id uuid,p_code text,p_libelle text,p_classe smallint
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_id uuid;
begin
  if v_uid is null or not public.compta_ecriture_autorisee(p_pharmacie) then
    raise exception 'Droit de configuration comptable requis' using errcode='42501';
  end if;
  if nullif(btrim(p_code),'') is null or length(btrim(p_code))>32
     or nullif(btrim(p_libelle),'') is null or length(btrim(p_libelle))>180
     or (p_classe is not null and p_classe not between 1 and 9) then
    raise exception 'Code, libellé ou classe invalide';
  end if;
  if p_id is null then
    insert into public.compta_plan_comptable(pharmacie_id,code,libelle,classe,statut)
    values(p_pharmacie,btrim(p_code),btrim(p_libelle),p_classe,'a_valider')
    returning id into v_id;
  else
    update public.compta_plan_comptable
      set code=btrim(p_code),libelle=btrim(p_libelle),classe=p_classe
      where id=p_id and pharmacie_id=p_pharmacie and statut='a_valider'
      returning id into v_id;
    if v_id is null then raise exception 'Compte absent ou déjà validé : modification interdite'; end if;
  end if;
  perform public.compta_auditer(p_pharmacie,v_uid,'plan_compte_enregistre','compte',v_id::text,'succes','Compte en attente de validation');
  return v_id;
end $$;

create or replace function public.compta_plan_valider_compte(p_pharmacie uuid,p_compte uuid)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null or not public.compta_ecriture_autorisee(p_pharmacie) then
    raise exception 'Droit de validation comptable requis' using errcode='42501';
  end if;
  update public.compta_plan_comptable set statut='valide',valide_par=v_uid,valide_le=now(),
    source_validation=coalesce(source_validation,'validation_utilisateur')
  where id=p_compte and pharmacie_id=p_pharmacie and statut='a_valider';
  if not found then raise exception 'Compte introuvable ou non éligible à la validation'; end if;
  perform public.compta_auditer(p_pharmacie,v_uid,'plan_compte_valide','compte',p_compte::text,'succes','Validation du compte');
  return true;
end $$;

create or replace function public.compta_plan_enregistrer_mapping(
  p_pharmacie uuid,p_id uuid,p_evenement_type text,p_sens text,p_compte uuid,
  p_valide_du date,p_valide_jusquau date
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_id uuid;
begin
  if v_uid is null or not public.compta_ecriture_autorisee(p_pharmacie) then
    raise exception 'Droit de configuration comptable requis' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_evenement_type,''))) not between 2 and 100
     or p_sens not in ('debit','credit')
     or (p_valide_du is not null and p_valide_jusquau is not null and p_valide_jusquau<p_valide_du)
     or not exists(select 1 from public.compta_plan_comptable c
       where c.id=p_compte and c.pharmacie_id=p_pharmacie and c.statut='valide') then
    raise exception 'Mapping invalide : événement, sens, période ou compte non validé';
  end if;
  if p_id is null then
    insert into public.compta_mapping_compte(pharmacie_id,evenement_type,sens,compte_id,statut,valide_du,valide_jusquau)
    values(p_pharmacie,btrim(p_evenement_type),p_sens,p_compte,'a_valider',p_valide_du,p_valide_jusquau)
    returning id into v_id;
  else
    update public.compta_mapping_compte set evenement_type=btrim(p_evenement_type),sens=p_sens,
      compte_id=p_compte,valide_du=p_valide_du,valide_jusquau=p_valide_jusquau
    where id=p_id and pharmacie_id=p_pharmacie and statut='a_valider'
    returning id into v_id;
    if v_id is null then raise exception 'Mapping absent ou déjà validé : modification interdite'; end if;
  end if;
  perform public.compta_auditer(p_pharmacie,v_uid,'mapping_compte_enregistre','mapping',v_id::text,'succes','Mapping en attente de validation');
  return v_id;
end $$;

create or replace function public.compta_plan_valider_mapping(p_pharmacie uuid,p_mapping uuid)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_event text; v_sens text; v_debut date; v_fin date; v_compte uuid;
begin
  if v_uid is null or not public.compta_ecriture_autorisee(p_pharmacie) then
    raise exception 'Droit de validation comptable requis' using errcode='42501';
  end if;
  select evenement_type,sens,valide_du,valide_jusquau,compte_id
    into v_event,v_sens,v_debut,v_fin,v_compte
  from public.compta_mapping_compte
  where id=p_mapping and pharmacie_id=p_pharmacie and statut='a_valider'
  for update;
  if not found or v_compte is null or not exists(select 1 from public.compta_plan_comptable
    where id=v_compte and pharmacie_id=p_pharmacie and statut='valide') then
    raise exception 'Mapping absent ou compte non validé';
  end if;
  if exists(select 1 from public.compta_mapping_compte m
    where m.pharmacie_id=p_pharmacie and m.id<>p_mapping and m.evenement_type=v_event
      and m.sens=v_sens and m.statut='valide'
      and daterange(coalesce(m.valide_du,'-infinity'::date),coalesce(m.valide_jusquau,'infinity'::date),'[]')
          && daterange(coalesce(v_debut,'-infinity'::date),coalesce(v_fin,'infinity'::date),'[]')) then
    raise exception 'Un mapping validé chevauche déjà cette période pour cet événement et ce sens';
  end if;
  update public.compta_mapping_compte set statut='valide',valide_par=v_uid,valide_le=now()
  where id=p_mapping and pharmacie_id=p_pharmacie;
  perform public.compta_auditer(p_pharmacie,v_uid,'mapping_compte_valide','mapping',p_mapping::text,'succes','Validation du mapping');
  return true;
end $$;

revoke all on function public.compta_plan_lister_pharmacies() from public,anon;
revoke all on function public.compta_plan_lire(uuid) from public,anon;
revoke all on function public.compta_plan_enregistrer_compte(uuid,uuid,text,text,smallint) from public,anon;
revoke all on function public.compta_plan_valider_compte(uuid,uuid) from public,anon;
revoke all on function public.compta_plan_enregistrer_mapping(uuid,uuid,text,text,uuid,date,date) from public,anon;
revoke all on function public.compta_plan_valider_mapping(uuid,uuid) from public,anon;
grant execute on function public.compta_plan_lister_pharmacies() to authenticated;
grant execute on function public.compta_plan_lire(uuid) to authenticated;
grant execute on function public.compta_plan_enregistrer_compte(uuid,uuid,text,text,smallint) to authenticated;
grant execute on function public.compta_plan_valider_compte(uuid,uuid) to authenticated;
grant execute on function public.compta_plan_enregistrer_mapping(uuid,uuid,text,text,uuid,date,date) to authenticated;
grant execute on function public.compta_plan_valider_mapping(uuid,uuid) to authenticated;

commit;
