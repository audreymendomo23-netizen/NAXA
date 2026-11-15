-- Keep a durable lot number in the audit journal when a stock lot is deleted.
-- The referenced stocks_lots row is already gone when an AFTER DELETE trigger runs;
-- inserting OLD.id into the journal would violate its ON DELETE SET NULL foreign key.
begin;

create or replace function private.journaliser_mouvement_stock_gestionnaire()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pharmacie uuid;
  v_produit uuid;
  v_lot uuid;
  v_source text;
  v_event text;
  v_q_before integer;
  v_q_after integer;
  v_numero_lot text;
  v_block_before boolean;
  v_block_after boolean;
  v_exp_before date;
  v_exp_after date;
  v_loc_before text;
  v_loc_after text;
  v_reason_before text;
  v_reason_after text;
  v_operation_reason text:=nullif(current_setting('naxa.stock_motif',true),'');
  v_event_source text:=coalesce(nullif(current_setting('naxa.stock_event_source',true),''),'online_movement');
  v_occurred_at timestamptz:=coalesce(nullif(current_setting('naxa.stock_occurred_at',true),'')::timestamptz,clock_timestamp());
  v_operation_id uuid:=nullif(current_setting('naxa.stock_operation_id',true),'')::uuid;
  v_actor uuid:=coalesce(nullif(current_setting('naxa.stock_actor_id',true),'')::uuid,auth.uid());
begin
  v_source:=tg_table_name;
  if tg_op='DELETE' then
    v_pharmacie:=old.pharmacie_id;
    v_produit:=old.produit_id;
    v_q_before:=old.quantite;
    v_loc_before:=old.emplacement;
    v_event:='suppression';
    if v_source='stocks_lots' then
      -- Preserve the human/business identifier, not the deleted FK target.
      v_lot:=null;
      v_numero_lot:=old.numero_lot;
      v_block_before:=old.bloque;
      v_exp_before:=old.date_peremption;
      v_reason_before:=old.motif_blocage;
    end if;
  elsif tg_op='INSERT' then
    v_pharmacie:=new.pharmacie_id;
    v_produit:=new.produit_id;
    v_q_after:=new.quantite;
    v_loc_after:=new.emplacement;
    v_event:='creation';
    if v_source='stocks_lots' then
      v_lot:=new.id;
      v_numero_lot:=new.numero_lot;
      v_block_after:=new.bloque;
      v_exp_after:=new.date_peremption;
      v_reason_after:=new.motif_blocage;
    end if;
  else
    v_pharmacie:=new.pharmacie_id;
    v_produit:=new.produit_id;
    v_q_before:=old.quantite;
    v_q_after:=new.quantite;
    v_loc_before:=old.emplacement;
    v_loc_after:=new.emplacement;
    v_event:='mise_a_jour';
    if v_source='stocks_lots' then
      v_lot:=new.id;
      v_numero_lot:=new.numero_lot;
      v_block_before:=old.bloque;
      v_block_after:=new.bloque;
      v_exp_before:=old.date_peremption;
      v_exp_after:=new.date_peremption;
      v_reason_before:=old.motif_blocage;
      v_reason_after:=new.motif_blocage;
      if old.quantite is distinct from new.quantite then
        v_event:='quantite';
      elsif old.bloque is distinct from new.bloque then
        v_event:='blocage';
      elsif old.date_peremption is distinct from new.date_peremption then
        v_event:='peremption';
      elsif old.emplacement is distinct from new.emplacement then
        v_event:='emplacement';
      elsif old.motif_blocage is distinct from new.motif_blocage then
        v_event:='blocage';
      else
        return new;
      end if;
    else
      if old.quantite is distinct from new.quantite then
        if not exists(
          select 1 from public.stocks_lots sl
          where sl.pharmacie_id=new.pharmacie_id
            and sl.produit_id=new.produit_id
        ) then
          v_event:='quantite';
        elsif old.emplacement is distinct from new.emplacement then
          v_event:='emplacement';
        else
          return new;
        end if;
      elsif old.emplacement is distinct from new.emplacement then
        v_event:='emplacement';
      else
        return new;
      end if;
    end if;
  end if;

  insert into public.stock_manager_movement_journal(
    pharmacie_id,produit_id,lot_id,numero_lot,source_table,event_type,
    quantite_avant,quantite_apres,bloque_avant,bloque_apres,
    date_peremption_avant,date_peremption_apres,emplacement_avant,emplacement_apres,
    motif_avant,motif_apres,motif_operation,acteur_id,occurred_at,event_source,operation_id
  ) values(
    v_pharmacie,v_produit,v_lot,v_numero_lot,v_source,v_event,
    v_q_before,v_q_after,v_block_before,v_block_after,
    v_exp_before,v_exp_after,v_loc_before,v_loc_after,
    v_reason_before,v_reason_after,v_operation_reason,v_actor,
    v_occurred_at,v_event_source,v_operation_id
  );

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;

commit;
