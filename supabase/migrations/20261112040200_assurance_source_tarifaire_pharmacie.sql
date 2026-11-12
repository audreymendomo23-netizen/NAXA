-- La couverture saisie par le client identifie ses droits ; elle ne fixe pas les taux métier.
-- Les paramètres financiers applicables viennent exclusivement de la convention pharmacie.
create or replace function public.assurance_enregistrer_couverture(
  p_assureur uuid,p_numero_adherent text,p_numero_police text,
  p_date_debut date,p_date_fin date,p_plafond numeric,p_taux numeric
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_id uuid;
begin
  if v_uid is null or not exists(
    select 1 from public.profiles p where p.id=v_uid and p.role='client' and p.actif=true
  ) then raise exception 'Compte client actif requis'; end if;
  if not exists(select 1 from public.assureurs a where a.id=p_assureur and a.actif=true) then
    raise exception 'Assureur inconnu ou inactif';
  end if;
  if length(trim(coalesce(p_numero_adherent,''))) not between 2 and 100
    or length(trim(coalesce(p_numero_police,'')))>100
    or p_date_debut is null or (p_date_fin is not null and p_date_fin<p_date_debut) then
    raise exception 'Informations de couverture invalides';
  end if;
  select id into v_id from public.couvertures_assurance
  where client_id=v_uid and assureur_id=p_assureur
    and lower(trim(numero_adherent))=lower(trim(p_numero_adherent))
  order by created_at desc limit 1;
  if v_id is not null then
    update public.couvertures_assurance set
      numero_police=nullif(trim(coalesce(p_numero_police,'')),''),
      date_debut=p_date_debut,date_fin=p_date_fin,plafond=null,
      taux_prise_en_charge=100,actif=true
    where id=v_id;
    return v_id;
  end if;
  insert into public.couvertures_assurance(
    client_id,assureur_id,numero_adherent,numero_police,date_debut,date_fin,plafond,taux_prise_en_charge,actif
  ) values(v_uid,p_assureur,trim(p_numero_adherent),
    nullif(trim(coalesce(p_numero_police,'')),''),p_date_debut,p_date_fin,null,100,true)
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.assurance_calculer_devis(p_reservation uuid,p_couverture uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=auth.uid(); v_r public.reservations%rowtype; v_c public.couvertures_assurance%rowtype;
  v_conv public.assurance_conventions%rowtype; v_item record; v_rule public.assurance_regles_convention%rowtype;
  v_snapshot uuid; v_brut bigint:=0; v_assureur bigint:=0; v_client bigint;
  v_line_brut bigint; v_line_cover bigint; v_rate numeric;
  v_lines jsonb:='[]'::jsonb; v_rules jsonb:='[]'::jsonb; v_docs jsonb:='[]'::jsonb;
  v_excluded boolean;
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

  -- Pas de plafond/taux client auto-déclaré dans le calcul : seule la convention pharmacie fait foi.
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
    if not found then raise exception 'Aucune règle de prise en charge ne couvre le produit %',v_item.nom; end if;

    v_excluded:=coalesce(v_rule.exclusions,'[]'::jsonb) ? v_item.produit_id::text
      or coalesce(v_rule.exclusions,'[]'::jsonb) ? coalesce(v_item.categorie,'__none__');
    v_rate:=v_rule.taux;
    if v_excluded then
      v_line_cover:=0;
    else
      v_line_cover:=round(v_line_brut*v_rate/100)::bigint;
      if v_rule.plafond_fcfa is not null then v_line_cover:=least(v_line_cover,v_rule.plafond_fcfa); end if;
      v_line_cover:=greatest(0,v_line_cover-coalesce(v_rule.franchise_fcfa,0));
    end if;
    v_docs:=v_docs||coalesce(v_rule.justificatifs_requis,'[]'::jsonb);
    v_rules:=v_rules||jsonb_build_array(jsonb_build_object(
      'rule_id',v_rule.id,'version',v_rule.version,'portee',v_rule.portee,
      'taux_applique',v_rate,'plafond_fcfa',v_rule.plafond_fcfa,
      'franchise_fcfa',v_rule.franchise_fcfa,'exclu',v_excluded
    ));
    v_assureur:=v_assureur+v_line_cover;
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'produit_id',v_item.produit_id,'nom',v_item.nom,'quantite',v_item.quantite,
      'prix_unitaire_fcfa',v_item.prix_unitaire,'montant_brut_fcfa',v_line_brut,
      'montant_assureur_fcfa',v_line_cover,'montant_client_fcfa',v_line_brut-v_line_cover
    ));
  end loop;
  v_brut:=coalesce(v_brut,0);
  if v_assureur>v_brut then raise exception 'Part assureur supérieure au montant brut'; end if;
  v_client:=v_brut-v_assureur;
  insert into public.assurance_reservation_snapshots(
    reservation_id,pharmacie_id,client_id,couverture_id,assureur_id,
    montant_brut_fcfa,montant_assureur_fcfa,montant_client_fcfa,regle_snapshot
  ) values(
    v_r.id,v_r.pharmacie_id,v_uid,v_c.id,v_c.assureur_id,
    v_brut,v_assureur,v_client,
    jsonb_build_object('convention_id',v_conv.id,'rules',v_rules,'items',v_lines,
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

revoke all on function public.assurance_enregistrer_couverture(uuid,text,text,date,date,numeric,numeric) from public,anon;
grant execute on function public.assurance_enregistrer_couverture(uuid,text,text,date,date,numeric,numeric) to authenticated;
revoke all on function public.assurance_calculer_devis(uuid,uuid) from public,anon;
grant execute on function public.assurance_calculer_devis(uuid,uuid) to authenticated;
