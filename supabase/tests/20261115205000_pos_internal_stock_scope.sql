-- Regression: internal POS inventory is private and independent of public Marketplace visibility.
begin;

do $contract$
declare
  v_definition text;
  v_signature regprocedure;
  v_pos_signatures regprocedure[] := array[
    'private.naxa_pos_debit_stock(uuid)'::regprocedure,
    'public.vente_ajouter_produit(uuid,uuid,integer)'::regprocedure,
    'public.caisse_rechercher_produit(uuid,text,text)'::regprocedure,
    'public.caisse_rechercher_codes(uuid,text[])'::regprocedure
  ];
begin
  v_definition := pg_get_functiondef('private.naxa_pos_stock_vendable(uuid,uuid)'::regprocedure);
  if v_definition not ilike '%security definer%'
     or position('search_path to' in lower(v_definition)) = 0
     or v_definition not ilike '%ph.actif is true%'
     or v_definition not ilike '%ph.archivee_le is null%'
     or v_definition not ilike '%stocks_lots%'
     or v_definition not ilike '%bloque%'
     or v_definition not ilike '%date_peremption%'
     or v_definition not ilike '%reservation_items%'
     or v_definition not ilike '%r.mode in%'
     or v_definition not ilike '%r.expires_at%'
     or v_definition ilike '%visible_recherche%'
     or v_definition ilike '%est_demo%'
     or v_definition ilike '%marketplace_stock_last_quantity_update%'
     or v_definition ilike '%fiche_validee%' then
    raise exception 'Le helper POS ne respecte pas le contrat privé/stock vendable attendu';
  end if;

  if has_function_privilege('anon','private.naxa_pos_stock_vendable(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.naxa_pos_stock_vendable(uuid,uuid)','EXECUTE')
     or has_function_privilege('service_role','private.naxa_pos_stock_vendable(uuid,uuid)','EXECUTE') then
    raise exception 'Le helper POS ne doit pas être directement exécutable via les rôles API';
  end if;

  foreach v_signature in array v_pos_signatures
  loop
    v_definition := pg_get_functiondef(v_signature);
    if v_definition not ilike '%private.naxa_pos_stock_vendable(%'
       or v_definition ilike '%public.marketplace_offre_stock_disponible(%' then
      raise exception 'Le consommateur POS % appelle encore le filtre Marketplace', v_signature;
    end if;

    if v_signature in (
      'public.caisse_rechercher_produit(uuid,text,text)'::regprocedure,
      'public.caisse_rechercher_codes(uuid,text[])'::regprocedure
    ) and (
      v_definition not ilike '%avail.prix%'
      or v_definition not ilike '%avail.quantite%'
      or v_definition ilike '%s.quantite%'
    ) then
      raise exception 'La recherche Caisse doit retourner le stock vendable interne, pas la quantité brute agrégée';
    end if;
  end loop;
end
$contract$;

do $runtime$
declare
  v_quantity integer;
  v_demo boolean;
  v_active boolean;
  v_visible boolean;
  v_archived timestamptz;
begin
  update public.pharmacies
  set visible_recherche = false
  where id = 'c57f49e0-5319-40c5-8486-967ed8316e8e'
    and actif is true
    and est_demo is true
    and archivee_le is null;
  if not found then
    raise exception 'Fixture Replay active/demo attendue indisponible';
  end if;

  select ph.est_demo, ph.actif, ph.visible_recherche, ph.archivee_le
    into v_demo, v_active, v_visible, v_archived
  from public.pharmacies ph
  where ph.id = 'c57f49e0-5319-40c5-8486-967ed8316e8e';

  select a.quantite into v_quantity
  from private.naxa_pos_stock_vendable(
    'c57f49e0-5319-40c5-8486-967ed8316e8e',
    'd38b7aff-a3a7-43b1-9c47-ed7739958e94'
  ) a;

  if v_quantity is null or v_quantity <= 0
     or v_demo is not true
     or v_active is not true
     or v_visible is not false
     or v_archived is not null then
    raise exception 'Le POS doit servir le stock actif non publié sans modifier le statut démo';
  end if;
end
$runtime$;

rollback;
select 'POS internal stock helper: private ACL, four server consumers rewired, hidden active pharmacy stock remains sellable: PASS' as result;
