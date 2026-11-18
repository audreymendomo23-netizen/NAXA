-- Lot B2 : parcours métier SQL authentifié sur les fixtures Replay dédiées.
-- À exécuter uniquement sur naxa-ci-replay-2 (pwfftcsjyeibxxqhwysw).
-- Tous les changements sont annulés par ROLLBACK ; aucun compte ni stock commercial n'est touché.
begin;

-- Cette pharmacie est explicitement non commerciale et non-démo. Sa visibilité est
-- activée uniquement dans cette transaction pour exercer le chemin public anon.
update public.pharmacies
set visible_recherche = true
where id = '1a4f1ce5-cccf-477e-9a5b-474c8c9fc713'
  and est_demo = false
  and archivee_le is null;

select set_config(
  'request.jwt.claim.sub',
  'dcb2242b-50fb-46c8-8c90-e01d42fa4175',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"dcb2242b-50fb-46c8-8c90-e01d42fa4175","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  v_reservation uuid;
  v_favori uuid;
  v_disponible integer;
  v_initial_disponible integer;
  v_statut text;
  v_visible integer;
begin
  -- Offre publique positive sous le même contrat que le Marketplace.
  select coalesce(max(o.quantite), 0)::integer into v_initial_disponible
  from public.marketplace_offre_stock_disponible(
    '1a4f1ce5-cccf-477e-9a5b-474c8c9fc713',
    'dfd7313c-46a4-455a-b67d-50f0ce2a3686'
  ) o;
  if v_initial_disponible < 1 then
    raise exception 'B2_PUBLIC_OFFER_EXPECTED_POSITIVE_STOCK_GOT_%', v_initial_disponible;
  end if;

  -- Favori : ajout, lecture par son propriétaire, retrait.
  insert into public.favoris_client(
    user_id, produit_ref, produit_id, nom, dosage, prix, pharmacie, demo
  ) values (
    auth.uid(),
    'dfd7313c-46a4-455a-b67d-50f0ce2a3686',
    'dfd7313c-46a4-455a-b67d-50f0ce2a3686',
    'NAXA E2E — Produit crédit comptoir',
    '',
    1000,
    'NAXA E2E — Pharmacie de recette (non commerciale)',
    false
  ) returning id into v_favori;

  select count(*) into v_visible
  from public.favoris_client
  where id = v_favori and user_id = auth.uid();
  if v_visible <> 1 then raise exception 'B2_FAVORITE_OWNER_READ_FAILED'; end if;

  delete from public.favoris_client
  where id = v_favori and user_id = auth.uid();
  if exists(select 1 from public.favoris_client where id = v_favori) then
    raise exception 'B2_FAVORITE_REMOVE_FAILED';
  end if;

  -- Réservation complète du stock : le hold doit rendre l'offre indisponible.
  v_reservation := private.reserve_stock(
    '1a4f1ce5-cccf-477e-9a5b-474c8c9fc713',
    jsonb_build_array(jsonb_build_object(
      'produit_id', 'dfd7313c-46a4-455a-b67d-50f0ce2a3686',
      'quantite', v_initial_disponible
    ))
  );

  select o.quantite into v_disponible
  from public.marketplace_offre_stock_disponible(
    '1a4f1ce5-cccf-477e-9a5b-474c8c9fc713',
    'dfd7313c-46a4-455a-b67d-50f0ce2a3686'
  ) o;
  if coalesce(v_disponible, -1) <> 0 then
    raise exception 'B2_ACTIVE_HOLD_DID_NOT_RESERVE_STOCK_%', v_disponible;
  end if;

  -- Une seconde commande ne doit pas pouvoir dépasser le stock disponible.
  begin
    perform private.reserve_stock(
      '1a4f1ce5-cccf-477e-9a5b-474c8c9fc713',
      '[{"produit_id":"dfd7313c-46a4-455a-b67d-50f0ce2a3686","quantite":1}]'::jsonb
    );
    raise exception 'B2_OVERSELL_NOT_BLOCKED';
  exception
    when others then
      if sqlerrm = 'B2_OVERSELL_NOT_BLOCKED'
         or position('Stock disponible insuffisant' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  -- Annulation par le Client : libération exacte du hold et présence dans son historique.
  perform public.set_reservation_status(v_reservation, 'annulee'::public.resa_statut);

  select o.quantite into v_disponible
  from public.marketplace_offre_stock_disponible(
    '1a4f1ce5-cccf-477e-9a5b-474c8c9fc713',
    'dfd7313c-46a4-455a-b67d-50f0ce2a3686'
  ) o;
  if coalesce(v_disponible, -1) <> v_initial_disponible then
    raise exception 'B2_CANCEL_DID_NOT_RELEASE_INITIAL_STOCK_EXPECTED_%_GOT_%', v_initial_disponible, v_disponible;
  end if;

  select r.statut::text into v_statut
  from public.reservations r
  where r.id = v_reservation and r.client_id = auth.uid();
  if v_statut <> 'annulee' then
    raise exception 'B2_CLIENT_ORDER_HISTORY_STATUS_MISSING';
  end if;

  if not exists (
    select 1 from public.reservations r
    where r.id = v_reservation and r.client_id = auth.uid()
  ) then
    raise exception 'B2_CLIENT_ORDER_HISTORY_ROW_NOT_VISIBLE';
  end if;
end
$$;

select 'LOT_B2_CLIENT_FAVORITES_RESERVATION_OVERSELL_CANCEL_HISTORY PASS' as result;
rollback;
