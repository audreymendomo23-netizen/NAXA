do $$
declare v_def text;
begin
  select pg_get_functiondef('private.marketplace_stock_last_quantity_update(uuid,uuid)'::regprocedure) into v_def;
  if position('greatest(' in v_def)=0 or position('s.updated_at' in v_def)=0
     or position('stock_manager_movement_journal' in v_def)=0 then
    raise exception 'FRESHNESS_MUST_USE_LATEST_OF_JOURNAL_AND_STOCK_ROW_UPDATE';
  end if;
end $$;

-- Vérification dynamique sur une ligne Replay sans historique journalisé :
-- 47 h 59 min 50 s doit rester visible ; 48 h 10 s doit être masqué.
-- La valeur updated_at d'origine est restaurée dans la même transaction.
do $
declare
  v_pharmacie uuid;
  v_produit uuid;
  v_old_updated_at timestamptz;
  v_count integer;
begin
  select s.pharmacie_id,s.produit_id,s.updated_at
    into v_pharmacie,v_produit,v_old_updated_at
  from public.stocks s
  join public.pharmacies ph on ph.id=s.pharmacie_id
  where s.quantite>0
    and (s.date_peremption is null or s.date_peremption>=current_date)
    and ph.actif is true and ph.visible_recherche is true
    and not exists(
      select 1 from public.stock_manager_movement_journal j
      where j.pharmacie_id=s.pharmacie_id and j.produit_id=s.produit_id
        and j.source_table in ('stocks','stocks_lots')
        and j.event_type in ('creation','quantite','suppression')
    )
  limit 1;

  if v_pharmacie is not null then
    update public.stocks set updated_at=clock_timestamp()-interval '48 hours'+interval '10 seconds'
    where pharmacie_id=v_pharmacie and produit_id=v_produit;
    select count(*) into v_count
    from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit);
    if v_count<>1 then raise exception 'STOCK_MUST_REMAIN_VISIBLE_BEFORE_48H'; end if;

    update public.stocks set updated_at=clock_timestamp()-interval '48 hours'-interval '10 seconds'
    where pharmacie_id=v_pharmacie and produit_id=v_produit;
    select count(*) into v_count
    from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit);
    if v_count<>0 then raise exception 'STOCK_MUST_BE_HIDDEN_AFTER_48H'; end if;

    update public.stocks set updated_at=v_old_updated_at
    where pharmacie_id=v_pharmacie and produit_id=v_produit;
  end if;
end $;

select 'MARKETPLACE_STOCK_VERIFICATION_TIMESTAMP PASS' as result;
