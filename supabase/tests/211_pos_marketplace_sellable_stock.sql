-- Vérifications structurelles du flux stock POS/Marketplace.
-- À exécuter après les migrations 210 et 211 dans un environnement de test.

begin;

do $test$
declare
  v_vente text;
  v_lookup text;
  v_bulk text;
begin
  if to_regprocedure('public.marketplace_offre_stock_disponible(uuid,uuid)') is null then
    raise exception 'Migration 210 requise avant les vérifications POS';
  end if;

  if to_regprocedure('public.vente_ajouter_produit(uuid,uuid,integer)') is null then
    raise exception 'RPC vente_ajouter_produit absente';
  end if;

  select pg_get_functiondef('public.vente_ajouter_produit(uuid,uuid,integer)'::regprocedure)
    into v_vente;
  select pg_get_functiondef('public.caisse_rechercher_produit(uuid,text,text)'::regprocedure)
    into v_lookup;
  select pg_get_functiondef('public.caisse_rechercher_codes(uuid,text[])'::regprocedure)
    into v_bulk;

  if position('Stock périmé : vente refusée' in v_vente) = 0 then
    raise exception 'La vente POS non lotisée ne refuse pas le stock périmé';
  end if;
  if position('marketplace_offre_stock_disponible' in v_lookup) = 0
     or position('marketplace_offre_stock_disponible' in v_bulk) = 0 then
    raise exception 'Les recherches Caisse ne calculent pas le stock vendable';
  end if;
  if position('stocks_lots' in v_vente) = 0
     or position('date_peremption' in v_vente) = 0
     or position('bloque' in v_vente) = 0 then
    raise exception 'Le débit POS ne conserve pas le contrôle FEFO des lots';
  end if;
end;
$test$;

rollback;
