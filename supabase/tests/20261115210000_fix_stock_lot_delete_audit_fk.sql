-- Verifies that deleting a lot writes an audit record without retaining a dangling lot FK.
-- The delete and journal insertion are rolled back so the Replay fixture remains unchanged.
begin;
select set_config('request.jwt.claim.role','service_role',true);

do $contract$
declare
  v_definition text;
  v_fk text;
  v_nullable text;
begin
  v_definition:=lower(pg_get_functiondef(
    'private.journaliser_mouvement_stock_gestionnaire()'::regprocedure
  ));
  if position('v_lot:=null' in regexp_replace(v_definition,'\s+','','g'))=0
     or position('v_numero_lot:=old.numero_lot' in regexp_replace(v_definition,'\s+','','g'))=0
     or position('v_event:=''suppression''' in regexp_replace(v_definition,'\s+','','g'))=0 then
    raise exception 'La suppression d''un lot doit détacher son UUID tout en conservant numero_lot et event_type=suppression';
  end if;

  select pg_get_constraintdef(c.oid) into v_fk
  from pg_constraint c
  where c.conrelid='public.stock_manager_movement_journal'::regclass
    and c.conname='stock_manager_movement_journal_lot_id_fkey';
  if v_fk is null or position('ON DELETE SET NULL' in upper(v_fk))=0 then
    raise exception 'La FK audit lot_id doit rester ON DELETE SET NULL';
  end if;

  select is_nullable into v_nullable
  from information_schema.columns
  where table_schema='public' and table_name='stock_manager_movement_journal'
    and column_name='lot_id';
  if v_nullable<>'YES' then
    raise exception 'La colonne audit lot_id doit rester nullable';
  end if;
end
$contract$;

do $runtime$
declare
  v_lot record;
  v_before integer;
  v_after integer;
begin
  select l.id,l.numero_lot,l.pharmacie_id,l.produit_id
    into v_lot
  from public.stocks_lots l
  where l.pharmacie_id='1a4f1ce5-cccf-477e-9a5b-474c8c9fc713'
    and l.produit_id='f90e2343-62e4-435a-abb1-286f18bc366f'
    and l.lot like 'NAXA-E2E-EXPIRY-%'
    and l.quantite=0
    and not exists(select 1 from public.rappels_lots r where r.lot_id=l.id)
    and not exists(select 1 from public.vente_lignes v where v.lot_id=l.id)
    and not exists(select 1 from public.rappels_lots_traitements t where t.lot_id=l.id)
    and not exists(select 1 from public.inventaire_ajustements a where a.lot_id=l.id)
    and not exists(select 1 from public.reservation_item_lots x where x.lot_id=l.id)
  order by l.created_at,l.id
  limit 1;

  if v_lot.id is null then
    raise exception 'Aucun ancien lot E2E à quantité zéro sans référence restrictive n''est disponible pour le test runtime';
  end if;

  select count(*) into v_before
  from public.stock_manager_movement_journal j
  where j.pharmacie_id=v_lot.pharmacie_id
    and j.produit_id=v_lot.produit_id
    and j.source_table='stocks_lots'
    and j.event_type='suppression'
    and j.numero_lot=v_lot.numero_lot;

  delete from public.stocks_lots where id=v_lot.id;

  if exists(select 1 from public.stocks_lots where id=v_lot.id) then
    raise exception 'Le lot de test n''a pas été supprimé';
  end if;

  select count(*) into v_after
  from public.stock_manager_movement_journal j
  where j.pharmacie_id=v_lot.pharmacie_id
    and j.produit_id=v_lot.produit_id
    and j.source_table='stocks_lots'
    and j.event_type='suppression'
    and j.numero_lot=v_lot.numero_lot
    and j.lot_id is null;

  if v_after<>v_before+1 then
    raise exception 'L''audit doit ajouter un événement sans FK lot_id : avant %, après %',v_before,v_after;
  end if;
end
$runtime$;

rollback;

select 'Stock-lot deletion preserves audit history without dangling lot FK: PASS (transaction rolled back)' as result;
