-- Parcours transactionnel Assurance : devis serveur, accord client et validation pharmacie.

create or replace function public.assurance_enregistrer_convention(
  p_pharmacie uuid,p_assureur uuid,p_reference text,p_debut date,p_fin date default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid:=auth.uid(); v_pharmacie uuid; v_id uuid;
begin
  if v_uid is null or private.naxa_business_function(v_uid) not in ('promoteur','pharmacien','responsable')
     or p_debut is null or (p_fin is not null and p_fin<p_debut) then
    raise exception 'Données ou poste non autorisés';
  end if;
  v_pharmacie:=p_pharmacie;
  if v_pharmacie is null or not private.naxa_scope_allows(v_uid,v_pharmacie,'PHARMACIE') then
    raise exception 'Pharmacie hors périmètre';
  end if;
  if not exists(select 1 from public.assureurs where id=p_assureur and actif) then
    raise exception 'Assureur inconnu ou inactif';
  end if;
  insert into public.assurance_conventions(pharmacie_id,assureur_id,reference_convention,date_debut,date_fin,cree_par)
  values(v_pharmacie,p_assureur,nullif(trim(coalesce(p_reference,'')),''),p_debut,p_fin,v_uid)
  on conflict(pharmacie_id,assureur_id) do update set
    reference_convention=excluded.reference_convention,date_debut=excluded.date_debut,
    date_fin=excluded.date_fin,statut='active',updated_at=now()
  returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.assurance_enregistrer_convention(uuid,uuid,text,date,date) from public,anon;
grant execute on function public.assurance_enregistrer_convention(uuid,text,date,date) to authenticated;

create or replace function public.assurance_enregistrer_regle(
  p_convention uuid,p_portee text,p_categorie text,p_produit uuid,p_taux numeric,
  p_plafond bigint,p_franchise bigint,p_exclusions jsonb,p_justificatifs jsonb,
  p_debut date,p_fin date
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid:=auth.uid(); v_pharmacie uuid; v_id uuid; v_version integer;
begin
  select c.pharmacie_id into v_pharmacie from public.assurance_conventions c where c.id=p_convention and c.statut='active';
  if v_uid is null or v_pharmacie is null
     or private.naxa_business_function(v_uid) not in ('promoteur','pharmacien','responsable')
     or not private.naxa_scope_allows(v_uid,v_pharmacie,'PHARMACIE') then
    raise exception 'Convention inaccessible ou poste non autorisé';
  end if;
  if p_portee not in ('tout','categorie','produit') or p_taux not between 0 and 100
     or coalesce(p_franchise,0)<0 or (p_plafond is not null and p_plafond<0)
     or p_debut is null or (p_fin is not null and p_fin<p_debut)
     or (p_portee='categorie' and nullif(trim(coalesce(p_categorie,'')),'') is null)
     or (p_portee='produit' and p_produit is null)
     or (p_portee='tout' and (p_categorie is not null or p_produit is not null))
     or jsonb_typeof(coalesce(p_exclusions,'[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_justificatifs,'[]'::jsonb))<>'array' then
    raise exception 'Règle de convention invalide';
  end if;
  select coalesce(max(version),0)+1 into v_version
  from public.assurance_regles_convention
  where convention_id=p_convention and portee=p_portee
    and coalesce(categorie,'')=coalesce(p_categorie,'')
    and coalesce(produit_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(p_produit,'00000000-0000-0000-0000-000000000000'::uuid);
  update public.assurance_regles_convention set actif=false
  where convention_id=p_convention and portee=p_portee
    and coalesce(categorie,'')=coalesce(p_categorie,'')
    and coalesce(produit_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(p_produit,'00000000-0000-0000-0000-000000000000'::uuid)
    and actif=true;
  insert into public.assurance_regles_convention(
    convention_id,portee,categorie,produit_id,taux,plafond_fcfa,franchise_fcfa,
    exclusions,justificatifs_requis,valide_du,valide_jusquau,version,cree_par
  ) values(p_convention,p_portee,nullif(trim(coalesce(p_categorie,'')),''),p_produit,p_taux,
    p_plafond,coalesce(p_franchise,0),coalesce(p_exclusions,'[]'::jsonb),
    coalesce(p_justificatifs,'[]'::jsonb),p_debut,p_fin,v_version,v_uid)
  returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.assurance_enregistrer_regle(uuid,text,text,uuid,numeric,bigint,bigint,jsonb,jsonb,date,date) from public,anon;
grant execute on function public.assurance_enregistrer_regle(uuid,text,text,uuid,numeric,bigint,bigint,jsonb,jsonb,date,date) to authenticated;

create or replace function public.assurance_calculer_devis(p_reservation uuid,p_couverture uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid:=auth.uid(); v_r public.reservations%rowtype; v_c public.couvertures_assurance%rowtype;
  v_conv public.assurance_conventions%rowtype; v_item record; v_rule public.assurance_regles_convention%rowtype;
  v_snapshot uuid; v_brut bigint:=0; v_assureur bigint:=0; v_client bigint;
  v_line_brut bigint; v_line_cover bigint; v_rate numeric; v_remaining bigint;
  v_lines jsonb:='[]'::jsonb; v_rules jsonb:='[]'::jsonb; v_docs jsonb:='[]'::jsonb;
begin
  if v_uid is null then raise exception 'Connexion client requise'; end if;
  select * into v_r from public.reservations where id=p_reservation and client_id=v_uid for update;
  if not found or v_r.mode<>'reservation' or v_r.statut not in ('en_attente','confirmee') then
    raise exception 'Réservation non éligible au devis assurance';
  end if;
  if exists(select 1 from public.assurance_reservation_snapshots where reservation_id=v_r.id) then
    raise exception 'Un devis est déjà figé pour cette réservation ; créez une nouvelle réservation pour recalculer';
  end if;
  select * into v_c from public.couvertures_assurance
  where id=p_couverture and client_id=v_uid and actif
    and date_debut<=current_date and (date_fin is null or date_fin>=current_date);
  if not found then raise exception 'Couverture client inactive ou expirée'; end if;
  select * into v_conv from public.assurance_conventions
  where pharmacie_id=v_r.pharmacie_id and assureur_id=v_c.assureur_id
    and statut='active' and date_debut<=current_date and (date_fin is null or date_fin>=current_date);
  if not found then raise exception 'Cette pharmacie n’a pas de convention active avec cet assureur'; end if;
  v_remaining:=case when v_c.plafond is null then 9223372036854775807 else greatest(0,round(v_c.plafond)::bigint) end;

  for v_item in
    select ri.produit_id,ri.quantite,ri.prix_unitaire,p.nom,p.categorie
    from public.reservation_items ri join public.produits p on p.id=ri.produit_id
    where ri.reservation_id=v_r.id order by ri.produit_id
  loop
    v_line_brut:=v_item.prix_unitaire::bigint*v_item.quantite::bigint;
    v_brut:=v_brut+v_line_brut;
    select * into v_rule from public.assurance_regles_convention r
    where r.convention_id=v_conv.id and r.actif
      and r.valide_du<=current_date and (r.valide_jusquau is null or r.valide_jusquau>=current_date)
      and (
        (r.portee='produit' and r.produit_id=v_item.produit_id)
        or (r.portee='categorie' and lower(r.categorie)=lower(v_item.categorie))
        or r.portee='tout'
      )
    order by case r.portee when 'produit' then 1 when 'categorie' then 2 else 3 end,
      r.valide_du desc,r.version desc limit 1;
    if not found then
      raise exception 'Aucune règle de prise en charge ne couvre le produit %',v_item.nom;
    else
      v_rate:=least(v_c.taux_prise_en_charge,v_rule.taux);
      v_line_cover:=round(v_line_brut*v_rate/100)::bigint;
      if v_rule.plafond_fcfa is not null then v_line_cover:=least(v_line_cover,v_rule.plafond_fcfa); end if;
      v_line_cover:=greatest(0,v_line_cover-coalesce(v_rule.franchise_fcfa,0));
      v_line_cover:=least(v_line_cover,v_remaining);
      v_remaining:=v_remaining-v_line_cover;
      if coalesce(v_rule.exclusions,'[]'::jsonb) ? v_item.produit_id::text
         or coalesce(v_rule.exclusions,'[]'::jsonb) ? coalesce(v_item.categorie,'__none__') then
        v_line_cover:=0;
      end if;
      v_docs:=v_docs || coalesce(v_rule.justificatifs_requis,'[]'::jsonb);
      v_rules:=v_rules || jsonb_build_array(jsonb_build_object(
        'rule_id',v_rule.id,'version',v_rule.version,'portee',v_rule.portee,
        'taux_applique',v_rate,'plafond_fcfa',v_rule.plafond_fcfa,
        'franchise_fcfa',v_rule.franchise_fcfa
      ));
    end if;
    v_assureur:=v_assureur+v_line_cover;
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'produit_id',v_item.produit_id,'nom',v_item.nom,'quantite',v_item.quantite,
      'prix_unitaire_fcfa',v_item.prix_unitaire,'montant_brut_fcfa',v_line_brut,
      'montant_assureur_fcfa',v_line_cover,'montant_client_fcfa',v_line_brut-v_line_cover
    ));
  end loop;
  v_brut:=coalesce(v_brut,0);
  v_client:=v_brut-v_assureur;
  insert into public.assurance_reservation_snapshots(
    reservation_id,pharmacie_id,client_id,couverture_id,assureur_id,
    montant_brut_fcfa,montant_assureur_fcfa,montant_client_fcfa,regle_snapshot
  ) values(
    v_r.id,v_r.pharmacie_id,v_uid,v_c.id,v_c.assureur_id,
    v_brut,v_assureur,v_client,
    jsonb_build_object('convention_id',v_conv.id,'couverture_taux',v_c.taux_prise_en_charge,
      'couverture_plafond_fcfa',v_c.plafond,'rules',v_rules,'items',v_lines,
      'justificatifs_requis',(select coalesce(jsonb_agg(distinct value),'[]'::jsonb) from jsonb_array_elements(v_docs)))
  ) returning id into v_snapshot;
  insert into public.dossiers_assurance(
    pharmacie_id,client_id,couverture_id,reservation_id,statut,
    montant_total,montant_prise_en_charge,montant_client,created_by
  ) values(v_r.pharmacie_id,v_uid,v_c.id,v_r.id,'brouillon',v_brut,v_assureur,v_client,v_uid);
  insert into public.assurance_evenements(
    pharmacie_id,reservation_id,assureur_id,acteur_id,type,montant_fcfa,details
  ) values(v_r.pharmacie_id,v_r.id,v_c.assureur_id,v_uid,'devis_calcule',v_brut,
    jsonb_build_object('snapshot_id',v_snapshot,'part_assureur_fcfa',v_assureur,'part_client_fcfa',v_client));
  return v_snapshot;
end
$$;
revoke all on function public.assurance_calculer_devis(uuid,uuid) from public,anon;
grant execute on function public.assurance_calculer_devis(uuid,uuid) to authenticated;

create or replace function public.assurance_valider_devis(p_snapshot uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid:=auth.uid(); v_s public.assurance_reservation_snapshots%rowtype; v_d uuid;
begin
  select * into v_s from public.assurance_reservation_snapshots where id=p_snapshot for update;
  if not found or v_s.client_id<>v_uid then raise exception 'Devis inaccessible'; end if;
  if v_s.valide_client then raise exception 'Devis déjà accepté'; end if;
  update public.assurance_reservation_snapshots set valide_client=true,valide_client_le=now() where id=p_snapshot;
  update public.dossiers_assurance set statut='soumis',soumis_at=now()
    where reservation_id=v_s.reservation_id and client_id=v_uid and statut='brouillon' returning id into v_d;
  if v_d is null then raise exception 'Dossier assurance introuvable'; end if;
  insert into public.assurance_evenements(pharmacie_id,reservation_id,dossier_id,assureur_id,acteur_id,type,montant_fcfa)
  values(v_s.pharmacie_id,v_s.reservation_id,v_d,v_s.assureur_id,v_uid,'reservation_assurance_validee',v_s.montant_brut_fcfa);
end
$$;
revoke all on function public.assurance_valider_devis(uuid) from public,anon;
grant execute on function public.assurance_valider_devis(uuid) to authenticated;

create or replace function public.assurance_controler_documents(
  p_snapshot uuid,p_conforme boolean,p_details jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid:=auth.uid(); v_s public.assurance_reservation_snapshots%rowtype;
begin
  select * into v_s from public.assurance_reservation_snapshots where id=p_snapshot for update;
  if not found or not private.naxa_scope_allows(v_uid,v_s.pharmacie_id,'PHARMACIE')
     or private.naxa_business_function(v_uid) not in ('promoteur','pharmacien','responsable','caisse') then
    raise exception 'Contrôle non autorisé';
  end if;
  if not v_s.valide_client then raise exception 'Le client doit accepter le devis avant contrôle'; end if;
  update public.assurance_reservation_snapshots
  set controle_documents_le=now(),controle_documents_par=v_uid,
      controle_documents_statut=case when p_conforme then 'conforme' else 'non_conforme' end
  where id=p_snapshot;
  insert into public.assurance_evenements(pharmacie_id,reservation_id,assureur_id,acteur_id,type,details)
  values(v_s.pharmacie_id,v_s.reservation_id,v_s.assureur_id,v_uid,'documents_controles',
    jsonb_build_object('conforme',p_conforme,'details',coalesce(p_details,'{}'::jsonb)));
end
$$;
revoke all on function public.assurance_controler_documents(uuid,boolean,jsonb) from public,anon;
grant execute on function public.assurance_controler_documents(uuid,boolean,jsonb) to authenticated;

create or replace function public.assurance_confirmer_prise_en_charge(p_dossier uuid,p_reference text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid:=auth.uid(); v_d public.dossiers_assurance%rowtype; v_s public.assurance_reservation_snapshots%rowtype;
begin
  select * into v_d from public.dossiers_assurance where id=p_dossier for update;
  if not found or not private.naxa_scope_allows(v_uid,v_d.pharmacie_id,'PHARMACIE')
     or private.naxa_business_function(v_uid) not in ('promoteur','pharmacien','responsable','caisse') then
    raise exception 'Dossier inaccessible ou poste non autorisé';
  end if;
  select * into v_s from public.assurance_reservation_snapshots where reservation_id=v_d.reservation_id for update;
  if not found or not v_s.valide_client or v_s.controle_documents_statut<>'conforme' then
    raise exception 'Accord client et contrôle conforme des justificatifs obligatoires';
  end if;
  if v_d.statut<>'soumis' then raise exception 'Dossier non soumis ou déjà traité'; end if;
  update public.dossiers_assurance set statut='accepte',reference_externe=nullif(trim(coalesce(p_reference,'')),''),traite_at=now()
  where id=v_d.id;
  insert into public.assurance_evenements(pharmacie_id,reservation_id,dossier_id,assureur_id,acteur_id,type,montant_fcfa,reference)
  values(v_d.pharmacie_id,v_d.reservation_id,v_d.id,v_s.assureur_id,v_uid,'prise_en_charge_confirmee',
    round(v_d.montant_prise_en_charge)::bigint,nullif(trim(coalesce(p_reference,'')),'')); 
  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,donnees,statut
  ) values(
    v_d.pharmacie_id,'assurance_prise_en_charge','dossier_assurance',v_d.id::text,
    'assurance-prise-en-charge:'||v_d.id::text,now(),
    jsonb_build_object('date_comptable',current_date::text,
      'montant_fcfa',round(v_d.montant_prise_en_charge)::bigint,
      'reference_source',coalesce(nullif(trim(coalesce(p_reference,'')),''),v_d.id::text),
      'dossier_id',v_d.id::text,'assureur_id',v_s.assureur_id::text),
    'a_traiter'
  ) on conflict (cle_idempotence) do nothing;
end
$$;
revoke all on function public.assurance_confirmer_prise_en_charge(uuid,text) from public,anon;
grant execute on function public.assurance_confirmer_prise_en_charge(uuid,text) to authenticated;

create or replace function public.assurance_refuser_prise_en_charge(p_dossier uuid,p_motif text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid:=auth.uid(); v_d public.dossiers_assurance%rowtype; v_s public.assurance_reservation_snapshots%rowtype;
begin
  select * into v_d from public.dossiers_assurance where id=p_dossier for update;
  if not found or not private.naxa_scope_allows(v_uid,v_d.pharmacie_id,'PHARMACIE')
     or private.naxa_business_function(v_uid) not in ('promoteur','pharmacien','responsable','caisse')
     or length(trim(coalesce(p_motif,'')))<3 then
    raise exception 'Refus non autorisé ou motif absent';
  end if;
  if v_d.statut<>'soumis' then raise exception 'Dossier non soumis ou déjà traité'; end if;
  select * into v_s from public.assurance_reservation_snapshots where reservation_id=v_d.reservation_id;
  update public.dossiers_assurance set statut='refuse',motif_refus=left(trim(p_motif),500),traite_at=now() where id=v_d.id;
  insert into public.assurance_evenements(pharmacie_id,reservation_id,dossier_id,assureur_id,acteur_id,type,montant_fcfa,details)
  values(v_d.pharmacie_id,v_d.reservation_id,v_d.id,v_s.assureur_id,v_uid,'prise_en_charge_refusee',
    round(v_d.montant_prise_en_charge)::bigint,jsonb_build_object('motif',left(trim(p_motif),500)));
end
$$;
revoke all on function public.assurance_refuser_prise_en_charge(uuid,text) from public,anon;
grant execute on function public.assurance_refuser_prise_en_charge(uuid,text) to authenticated;
