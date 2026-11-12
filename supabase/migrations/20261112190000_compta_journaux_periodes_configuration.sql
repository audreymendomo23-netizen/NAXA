-- NAXA — configuration opérationnelle des journaux et périodes comptables.
begin;

create or replace function public.compta_config_lire(p_pharmacie uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_role text; v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentification requise' using errcode='42501'; end if;
  v_role:=private.naxa_business_function(v_uid);
  if not private.naxa_scope_allows(v_uid,p_pharmacie,'PHARMACIE')
     or not ((v_role='promoteur' and private.naxa_promoteur_valide(v_uid))
       or (v_role='comptable' and public.compta_scope_autorise(p_pharmacie))) then
    raise exception 'Pharmacie hors périmètre comptable' using errcode='42501';
  end if;
  select jsonb_build_object(
    'periodes',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'date_debut',p.date_debut,'date_fin',p.date_fin,'statut',p.statut,'cloturee_le',p.cloturee_le
    ) order by p.date_debut desc) from public.compta_periodes p where p.pharmacie_id=p_pharmacie),'[]'::jsonb),
    'journaux',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'evenement_type',substring(p.cle from length('journal_code.')+1),
      'journal_code',case when jsonb_typeof(p.valeur)='string' then p.valeur #>> '{}' else null end,
      'statut',p.statut,'valide_du',p.valide_du,'valide_jusquau',p.valide_jusquau
    ) order by p.cle,p.valide_du desc) from public.compta_parametre p
      where p.pharmacie_id=p_pharmacie and p.cle like 'journal_code.%'),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.compta_config_enregistrer_journal(
  p_pharmacie uuid,p_id uuid,p_evenement_type text,p_journal_code text,p_valide_du date,p_valide_jusquau date
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_cle text:='journal_code.' || coalesce(trim(p_evenement_type),'');
begin
  if v_uid is null or not public.compta_ecriture_autorisee(p_pharmacie) then
    raise exception 'Droit de configuration comptable requis' using errcode='42501';
  end if;
  if trim(coalesce(p_evenement_type,'')) not in ('vente_encaissee','depense_validee','vente_annulee','assurance_prise_en_charge','assurance_remboursement_recu')
     or trim(coalesce(p_journal_code,'')) !~ '^[A-Za-z0-9_-]{1,20}$'
     or p_valide_du is null or (p_valide_jusquau is not null and p_valide_jusquau<p_valide_du) then
    raise exception 'Type d’événement, code journal ou période de validité invalide';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_pharmacie::text || ':' || v_cle,0));
  if p_id is null then
    insert into public.compta_parametre(pharmacie_id,cle,valeur,statut,valide_du,valide_jusquau)
    values(p_pharmacie,v_cle,to_jsonb(trim(p_journal_code)),'a_valider',p_valide_du,p_valide_jusquau)
    returning id into v_id;
  else
    update public.compta_parametre set cle=v_cle,valeur=to_jsonb(trim(p_journal_code)),statut='a_valider',
      valide_du=p_valide_du,valide_jusquau=p_valide_jusquau,valide_par=null,updated_at=now()
    where id=p_id and pharmacie_id=p_pharmacie and statut in ('a_renseigner','a_valider')
    returning id into v_id;
    if v_id is null then raise exception 'Journal absent ou déjà validé : modification interdite'; end if;
  end if;
  perform public.compta_auditer(p_pharmacie,v_uid,'journal_comptable_enregistre','journal',v_id::text,
    'succes','Journal ' || v_cle || ' en attente de validation');
  return v_id;
end $$;

create or replace function public.compta_config_valider_journal(p_pharmacie uuid,p_parametre uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_row public.compta_parametre%rowtype;
begin
  if v_uid is null or not public.compta_ecriture_autorisee(p_pharmacie) then
    raise exception 'Droit de validation comptable requis' using errcode='42501';
  end if;
  select * into v_row from public.compta_parametre
  where id=p_parametre and pharmacie_id=p_pharmacie and cle like 'journal_code.%' and statut='a_valider' for update;
  if not found then raise exception 'Journal absent ou déjà validé'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_pharmacie::text || ':' || v_row.cle,0));
  if v_row.valide_du is null or jsonb_typeof(v_row.valeur)<>'string'
     or length(trim(v_row.valeur #>> '{}')) not between 1 and 20 then
    raise exception 'Journal incomplet : code et date de début obligatoires';
  end if;
  if exists(select 1 from public.compta_parametre p where p.pharmacie_id=p_pharmacie
    and p.cle=v_row.cle and p.id<>v_row.id and p.statut='valide'
    and daterange(p.valide_du,coalesce(p.valide_jusquau,'infinity'::date),'[]')
      && daterange(v_row.valide_du,coalesce(v_row.valide_jusquau,'infinity'::date),'[]')) then
    raise exception 'Un journal validé chevauche déjà cette période de validité';
  end if;
  update public.compta_parametre set statut='valide',valide_par=v_uid,updated_at=now()
  where id=v_row.id and pharmacie_id=p_pharmacie;
  perform public.compta_auditer(p_pharmacie,v_uid,'journal_comptable_valide','journal',v_row.id::text,
    'succes','Validation du journal ' || v_row.cle);
  return true;
end $$;

create or replace function public.compta_config_ouvrir_periode(p_pharmacie uuid,p_date_debut date,p_date_fin date)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_id uuid;
begin
  if v_uid is null or not public.compta_ecriture_autorisee(p_pharmacie) then
    raise exception 'Droit de configuration comptable requis' using errcode='42501';
  end if;
  if p_date_debut is null or p_date_fin is null or p_date_fin<p_date_debut then
    raise exception 'Dates de période invalides';
  end if;
  if not exists(select 1 from public.pharmacies ph where ph.id=p_pharmacie and ph.actif is true) then
    raise exception 'Pharmacie inactive ou introuvable';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_pharmacie::text,0));
  if exists(select 1 from public.compta_periodes p where p.pharmacie_id=p_pharmacie
    and p.date_debut<=p_date_fin and p.date_fin>=p_date_debut) then
    raise exception 'Ouverture refusée : la période chevauche une période existante';
  end if;
  insert into public.compta_periodes(pharmacie_id,date_debut,date_fin,statut)
  values(p_pharmacie,p_date_debut,p_date_fin,'ouverte') returning id into v_id;
  perform public.compta_auditer(p_pharmacie,v_uid,'periode_comptable_ouverte','periode',v_id::text,
    'succes','debut=' || p_date_debut::text || '; fin=' || p_date_fin::text);
  return v_id;
end $$;

revoke all on function public.compta_config_lire(uuid) from public,anon;
revoke all on function public.compta_config_enregistrer_journal(uuid,uuid,text,text,date,date) from public,anon;
revoke all on function public.compta_config_valider_journal(uuid,uuid) from public,anon;
revoke all on function public.compta_config_ouvrir_periode(uuid,date,date) from public,anon;
grant execute on function public.compta_config_lire(uuid) to authenticated;
grant execute on function public.compta_config_enregistrer_journal(uuid,uuid,text,text,date,date) to authenticated;
grant execute on function public.compta_config_valider_journal(uuid,uuid) to authenticated;
grant execute on function public.compta_config_ouvrir_periode(uuid,date,date) to authenticated;
commit;
