-- NAXA 204 — journal consultable des changements de stock et de lots.
begin;
create table if not exists public.stock_manager_movement_journal(
 id bigint generated always as identity primary key,
 pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
 produit_id uuid not null references public.produits(id) on delete restrict,
 lot_id uuid references public.stocks_lots(id) on delete set null,
 numero_lot text,
 source_table text not null check(source_table in ('stocks','stocks_lots')),
 event_type text not null check(event_type in ('creation','suppression','quantite','blocage','peremption','emplacement','mise_a_jour')),
 quantite_avant integer,
 quantite_apres integer,
 bloque_avant boolean,
 bloque_apres boolean,
 date_peremption_avant date,
 date_peremption_apres date,
 emplacement_avant text,
 emplacement_apres text,
 motif_avant text,
 motif_apres text,
 acteur_id uuid references auth.users(id) on delete set null,
 cree_le timestamptz not null default now()
);
create index if not exists stock_manager_movement_journal_scope_idx on public.stock_manager_movement_journal(pharmacie_id,cree_le desc);
create index if not exists stock_manager_movement_journal_lot_idx on public.stock_manager_movement_journal(lot_id,cree_le desc) where lot_id is not null;
alter table public.stock_manager_movement_journal enable row level security;
drop policy if exists stock_manager_movement_journal_read_scope on public.stock_manager_movement_journal;
create policy stock_manager_movement_journal_read_scope on public.stock_manager_movement_journal
 for select to authenticated using(public.is_admin() or public.naxa_scope_allows((select auth.uid()),pharmacie_id,'PHARMACIE'));
revoke all on public.stock_manager_movement_journal from public,anon,authenticated;
grant select on public.stock_manager_movement_journal to authenticated;

create or replace function private.journaliser_mouvement_stock_gestionnaire()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare
 v_pharmacie uuid; v_produit uuid; v_lot uuid; v_source text; v_event text;
 v_q_before integer; v_q_after integer; v_numero_lot text; v_block_before boolean; v_block_after boolean;
 v_exp_before date; v_exp_after date; v_loc_before text; v_loc_after text;
 v_reason_before text; v_reason_after text; v_actor uuid:=auth.uid();
begin
 v_source:=tg_table_name;
 if tg_op='DELETE' then
  v_pharmacie:=old.pharmacie_id; v_produit:=old.produit_id;
  v_q_before:=old.quantite; v_loc_before:=old.emplacement;
  v_event:='suppression';
  if v_source='stocks_lots' then v_lot:=old.id; v_numero_lot:=old.numero_lot; v_block_before:=old.bloque; v_exp_before:=old.date_peremption; v_reason_before:=old.motif_blocage; end if;
 elsif tg_op='INSERT' then
  v_pharmacie:=new.pharmacie_id; v_produit:=new.produit_id;
  v_q_after:=new.quantite; v_loc_after:=new.emplacement;
  v_event:='creation';
  if v_source='stocks_lots' then v_lot:=new.id; v_numero_lot:=new.numero_lot; v_block_after:=new.bloque; v_exp_after:=new.date_peremption; v_reason_after:=new.motif_blocage; end if;
 else
  v_pharmacie:=new.pharmacie_id; v_produit:=new.produit_id;
  v_q_before:=old.quantite; v_q_after:=new.quantite;
  v_loc_before:=old.emplacement; v_loc_after:=new.emplacement;
  v_event:='mise_a_jour';
  if v_source='stocks_lots' then
   v_lot:=new.id; v_numero_lot:=new.numero_lot; v_block_before:=old.bloque; v_block_after:=new.bloque;
   v_exp_before:=old.date_peremption; v_exp_after:=new.date_peremption;
   v_reason_before:=old.motif_blocage; v_reason_after:=new.motif_blocage;
   if old.quantite is distinct from new.quantite then v_event:='quantite';
   elsif old.bloque is distinct from new.bloque then v_event:='blocage';
   elsif old.date_peremption is distinct from new.date_peremption then v_event:='peremption';
   elsif old.emplacement is distinct from new.emplacement then v_event:='emplacement';
   elsif old.motif_blocage is distinct from new.motif_blocage then v_event:='blocage';
   else return new; end if;
  else
   if old.quantite is distinct from new.quantite then
    -- Les mouvements d’un produit lotisé sont tracés au niveau de chaque lot.
    if not exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=new.pharmacie_id and sl.produit_id=new.produit_id) then v_event:='quantite';
    elsif old.emplacement is distinct from new.emplacement then v_event:='emplacement';
    else return new; end if;
   elsif old.emplacement is distinct from new.emplacement then v_event:='emplacement';
   else return new; end if;
  end if;
 end if;
 insert into public.stock_manager_movement_journal(
  pharmacie_id,produit_id,lot_id,numero_lot,source_table,event_type,quantite_avant,quantite_apres,
  bloque_avant,bloque_apres,date_peremption_avant,date_peremption_apres,
  emplacement_avant,emplacement_apres,motif_avant,motif_apres,acteur_id)
 values(v_pharmacie,v_produit,v_lot,v_numero_lot,v_source,v_event,v_q_before,v_q_after,
  v_block_before,v_block_after,v_exp_before,v_exp_after,v_loc_before,v_loc_after,
  v_reason_before,v_reason_after,v_actor);
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$function$;
revoke all on function private.journaliser_mouvement_stock_gestionnaire() from public,anon,authenticated;

drop trigger if exists trg_journal_stock_manager_stocks on public.stocks;
create trigger trg_journal_stock_manager_stocks after insert or update or delete on public.stocks
for each row execute function private.journaliser_mouvement_stock_gestionnaire();
drop trigger if exists trg_journal_stock_manager_lots on public.stocks_lots;
create trigger trg_journal_stock_manager_lots after insert or update or delete on public.stocks_lots
for each row execute function private.journaliser_mouvement_stock_gestionnaire();
comment on table public.stock_manager_movement_journal is 'Journal append-only des changements de stock agrégé et des lots, consultable par le périmètre pharmacie autorisé.';
commit;
