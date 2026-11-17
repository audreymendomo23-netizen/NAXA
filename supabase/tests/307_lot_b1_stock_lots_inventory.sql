-- Lot B1 : mouvements, lots et inventaire via le compte Gestionnaire de stock E2E.
-- Replay uniquement : naxa-ci-replay-2 (pwfftcsjyeibxxqhwysw).
-- La pharmacie Mvan est une fixture démo ; toute la recette est annulée par ROLLBACK.
begin;

insert into public.stocks(pharmacie_id,produit_id,prix,quantite,updated_at)
values (
  '76dd4983-273a-4a83-ae3d-9a7838d3aa35',
  'dfd7313c-46a4-455a-b67d-50f0ce2a3686',
  1000,
  5,
  now()
);

select set_config(
  'request.jwt.claim.sub',
  '5f03b180-2605-4de4-8161-f719ce24ae82',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"5f03b180-2605-4de4-8161-f719ce24ae82","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  v_lot uuid;
  v_inventaire uuid;
  v_ligne uuid;
  v_quantite integer;
begin
  -- Le premier lot reprend exactement le stock agrégé existant.
  v_lot := public.stock_lot_enregistrer(
    '76dd4983-273a-4a83-ae3d-9a7838d3aa35',
    'dfd7313c-46a4-455a-b67d-50f0ce2a3686',
    'B1-LOT-TEST-01',
    current_date + 365,
    5,
    null
  );

  -- Mouvement positif puis perte négative sur le lot ; le stock agrégé suit.
  perform public.gestionnaire_stock_quantite_ajuster(
    '76dd4983-273a-4a83-ae3d-9a7838d3aa35',
    'dfd7313c-46a4-455a-b67d-50f0ce2a3686',
    2,
    'retour',
    'Retour test B1',
    v_lot
  );
  perform public.gestionnaire_stock_quantite_ajuster(
    '76dd4983-273a-4a83-ae3d-9a7838d3aa35',
    'dfd7313c-46a4-455a-b67d-50f0ce2a3686',
    -1,
    'perte',
    'Perte test B1',
    v_lot
  );

  select quantite into v_quantite
  from public.stocks
  where pharmacie_id = '76dd4983-273a-4a83-ae3d-9a7838d3aa35'
    and produit_id = 'dfd7313c-46a4-455a-b67d-50f0ce2a3686';
  if v_quantite <> 6 then
    raise exception 'B1_STOCK_AFTER_MOVEMENTS_EXPECTED_6_GOT_%', v_quantite;
  end if;

  -- Inventaire complet : le détail doit porter le lot et clôturer sur le comptage.
  v_inventaire := public.gestionnaire_stock_inventaire_demarrer(
    '76dd4983-273a-4a83-ae3d-9a7838d3aa35',
    'complet'::public.inventaire_type,
    'LOT-B1-TEST'
  );

  select id into v_ligne
  from public.inventaire_lignes
  where inventaire_id = v_inventaire and lot_id = v_lot;
  if v_ligne is null then raise exception 'B1_INVENTORY_LOT_LINE_MISSING'; end if;

  perform public.gestionnaire_stock_inventaire_compter(v_ligne, 4);
  perform public.inventaire_cloturer(v_inventaire);

  select quantite into v_quantite
  from public.stocks
  where pharmacie_id = '76dd4983-273a-4a83-ae3d-9a7838d3aa35'
    and produit_id = 'dfd7313c-46a4-455a-b67d-50f0ce2a3686';
  if v_quantite <> 4 then
    raise exception 'B1_INVENTORY_FINAL_EXPECTED_4_GOT_%', v_quantite;
  end if;

  if (select statut from public.inventaires where id = v_inventaire) <> 'cloture' then
    raise exception 'B1_INVENTORY_NOT_CLOSED';
  end if;
end
$$;

select 'LOT_B1_STOCK_LOT_MOVEMENTS_AND_INVENTORY PASS' as result;
rollback;
