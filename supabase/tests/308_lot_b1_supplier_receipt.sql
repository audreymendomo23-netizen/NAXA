-- Lot B1 : réception fournisseur réelle via le compte Gestionnaire de stock E2E.
-- Replay uniquement : naxa-ci-replay-2 (pwfftcsjyeibxxqhwysw).
-- La commande, le fournisseur, le lot et les écritures de stock sont annulés par ROLLBACK.
begin;

insert into public.stocks(pharmacie_id,produit_id,prix,quantite,updated_at)
values (
  '76dd4983-273a-4a83-ae3d-9a7838d3aa35',
  'dfd7313c-46a4-455a-b67d-50f0ce2a3686',
  1000,
  0,
  now()
);

-- Créer la commande envoyée sous le rôle DB de test, puis conserver ses IDs
-- dans des paramètres transactionnels pour l'appel authentifié ci-dessous.
do $$
declare
  v_user uuid := '5f03b180-2605-4de4-8161-f719ce24ae82';
  v_supplier uuid;
  v_order uuid;
  v_line uuid;
begin
  insert into public.fournisseurs(nom,created_by)
  values('NAXA E2E Fournisseur B1',v_user)
  returning id into v_supplier;

  insert into public.commandes_fournisseurs(
    pharmacie_id,fournisseur_id,reference,statut,created_by
  ) values (
    '76dd4983-273a-4a83-ae3d-9a7838d3aa35',
    v_supplier,
    'B1-CMD-TEST',
    'envoyee',
    v_user
  ) returning id into v_order;

  insert into public.commandes_fournisseurs_lignes(
    commande_id,produit_id,quantite_commandee,prix_unitaire_prevu
  ) values (
    v_order,
    'dfd7313c-46a4-455a-b67d-50f0ce2a3686',
    4,
    1000
  ) returning id into v_line;

  perform set_config('naxa.test.order_id',v_order::text,true);
  perform set_config('naxa.test.line_id',v_line::text,true);
end
$$;

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
  v_reception uuid;
begin
  v_reception := public.fournisseur_reception_enregistrer(
    current_setting('naxa.test.order_id')::uuid,
    jsonb_build_array(jsonb_build_object(
      'commande_ligne_id',current_setting('naxa.test.line_id'),
      'quantite_recue',4,
      'numero_lot','B1-RECEPTION-TEST',
      'date_peremption',(current_date+365)::text,
      'emplacement','RAYON-A'
    )),
    'BL-B1-TEST',
    'Réception test'
  );
  perform set_config('naxa.test.reception_id',v_reception::text,true);
end
$$;

reset role;

do $$
declare
  v_stock integer;
  v_lots integer;
  v_status text;
begin
  select quantite into v_stock
  from public.stocks
  where pharmacie_id='76dd4983-273a-4a83-ae3d-9a7838d3aa35'
    and produit_id='dfd7313c-46a4-455a-b67d-50f0ce2a3686';

  select coalesce(sum(quantite),0)::integer into v_lots
  from public.stocks_lots
  where pharmacie_id='76dd4983-273a-4a83-ae3d-9a7838d3aa35'
    and produit_id='dfd7313c-46a4-455a-b67d-50f0ce2a3686';

  select statut into v_status
  from public.commandes_fournisseurs
  where id=current_setting('naxa.test.order_id')::uuid;

  if v_stock<>4 or v_lots<>4 or v_status<>'recue'
     or not exists(
       select 1 from public.receptions_fournisseurs
       where id=current_setting('naxa.test.reception_id')::uuid
     ) then
    raise exception 'B1_SUPPLIER_RECEIPT_INTEGRITY_FAIL stock=% lots=% status=%',
      v_stock,v_lots,v_status;
  end if;
end
$$;

select 'LOT_B1_SUPPLIER_RECEIPT_LOT_STOCK_SYNC PASS' as result;
rollback;
