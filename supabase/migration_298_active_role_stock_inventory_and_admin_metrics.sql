-- NAXA 298 — terminer le raccordement des mutations Stock historiques au poste actif.
begin;

do $patch$
declare
  v_signature text;
  v_sql text;
  v_replaced integer;
  v_stock_functions text[]:=array[
    'public.gestionnaire_stock_inventaire_demarrer(uuid,inventaire_type,text)',
    'public.gestionnaire_stock_inventaire_ajouter_produit(uuid,uuid)',
    'public.gestionnaire_stock_inventaire_compter(uuid,integer)',
    'public.gestionnaire_stock_inventaire_annuler(uuid)',
    'public.gestionnaire_stock_reference_initialiser(uuid,uuid,integer,text)',
    'public.gestionnaire_stock_quantite_ajuster(uuid,uuid,integer,text,text,uuid)',
    'public.gestionnaire_stock_reservation_confirmer(uuid)',
    'public.gestionnaire_stock_reservation_annuler(uuid)',
    'public.gestionnaire_stock_service_ouvrir(uuid)',
    'public.gestionnaire_stock_transfert_atomique(uuid,uuid,uuid,integer,uuid,text)',
    'public.inventaire_cloturer(uuid)'
  ];
begin
  foreach v_signature in array v_stock_functions loop
    v_sql:=pg_get_functiondef(v_signature::regprocedure);
    v_replaced:=0;

    if position($old$coalesce(v_profile.role::text,'') in ('admin','promoteur')$old$ in v_sql)>0 then
      v_sql:=replace(v_sql,
        $old$coalesce(v_profile.role::text,'') in ('admin','promoteur')$old$,
        $new$public.naxa_business_function(v_user) in ('admin','promoteur')$new$);
      v_replaced:=v_replaced+1;
    end if;

    if position($old$coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')$old$ in v_sql)>0 then
      v_sql:=replace(v_sql,
        $old$coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')$old$,
        $new$public.naxa_business_function(v_user) in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')$new$);
      v_replaced:=v_replaced+1;
    end if;

    if position($old$coalesce(v_profile.fonction_interne,'') in ('gestionnaire_stock','magasinier','pharmacien','pharmacien_assistant','responsable')$old$ in v_sql)>0 then
      v_sql:=replace(v_sql,
        $old$coalesce(v_profile.fonction_interne,'') in ('gestionnaire_stock','magasinier','pharmacien','pharmacien_assistant','responsable')$old$,
        $new$public.naxa_business_function(v_user) in ('gestionnaire_stock','magasinier','pharmacien','pharmacien_assistant','responsable')$new$);
      v_replaced:=v_replaced+1;
    end if;

    if v_replaced=0 then
      raise exception 'Aucune ancienne garde identité détectée dans %',v_signature;
    end if;
    execute v_sql;
  end loop;

  -- La fermeture d'un service Stock historique exige encore le poste et la
  -- pharmacie sélectionnés, et non le seul identifiant du propriétaire.
  v_sql:=pg_get_functiondef('public.gestionnaire_stock_service_fermer(uuid,text)'::regprocedure);
  if position($old$ if p_note is not null and char_length(trim(p_note))>500 then raise exception 'Note limitée à 500 caractères'; end if;
 update public.gestionnaire_stock_sessions$old$ in v_sql)=0 then
    raise exception 'Point d''insertion fermeture service Stock introuvable';
  end if;
  v_sql:=replace(v_sql,
    $old$ if p_note is not null and char_length(trim(p_note))>500 then raise exception 'Note limitée à 500 caractères'; end if;
 update public.gestionnaire_stock_sessions$old$,
    $new$ if p_note is not null and char_length(trim(p_note))>500 then raise exception 'Note limitée à 500 caractères'; end if;
 if public.naxa_business_function(v_user) not in ('gestionnaire_stock','magasinier')
   or not exists(select 1 from public.gestionnaire_stock_sessions s
     where s.id=p_session and s.user_id=v_user
       and s.pharmacie_id=public.naxa_active_role_pharmacy(v_user)
       and s.ended_at is null) then
   raise exception 'Fermeture réservée au poste Gestionnaire de stock actif dans cette pharmacie';
 end if;
 update public.gestionnaire_stock_sessions$new$);
  execute v_sql;

  -- L'indicateur global reste réservé à un Admin explicitement sélectionné.
  v_sql:=pg_get_functiondef('private.admin_comptes_indicateurs(integer)'::regprocedure);
  if position($old$  select p.role::text into v_role
  from public.profiles p
  where p.id = v_uid and p.actif = true;$old$ in v_sql)=0 then
    raise exception 'Résolution du rôle Admin pour les indicateurs introuvable';
  end if;
  v_sql:=replace(v_sql,
    $old$  select p.role::text into v_role
  from public.profiles p
  where p.id = v_uid and p.actif = true;$old$,
    $new$  v_role:=public.naxa_business_function(v_uid);$new$);
  execute v_sql;
end;
$patch$;

comment on function private.admin_comptes_indicateurs(integer) is
  'Agrégats Admin exécutables uniquement lorsque le profil a sélectionné le poste Admin actif.';

commit;
