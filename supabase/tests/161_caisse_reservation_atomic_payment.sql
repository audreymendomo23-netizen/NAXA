-- NAXA 161 — test structurel du paiement comptoir lié à une réservation.
begin;

do $test$
declare
  v_fn text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='ventes' and column_name='reservation_id'
  ) then
    raise exception 'ventes.reservation_id absent';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='ventes_reservation_id_uq'
  ) then
    raise exception 'Index unique empêchant le double encaissement absent';
  end if;

  select pg_get_functiondef(p.oid)
    into v_fn
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='vente_reservation_encaisser'
    and p.pronargs=3;

  if v_fn is null
     or position('auth.uid()' in lower(v_fn))=0
     or position('p_session' in lower(v_fn))=0
     or position('naxa_caisse_actor_for_pharmacy' in lower(v_fn))=0
     or position('p_montant_percu' in lower(v_fn))=0
     or position('public.vente_encaisser_finaliser' in lower(v_fn))=0
     or position('public.set_reservation_status' in lower(v_fn))=0
     or position('reservation_items' in lower(v_fn))=0
     or position('expires_at' in lower(v_fn))=0 then
    raise exception 'Encaissement réservation : garde de session, expiration ou finalisation incomplète';
  end if;

  if position('update public.stocks' in lower(v_fn))>0
     or position('update public.stocks_lots' in lower(v_fn))>0 then
    raise exception 'La réservation débite le stock une seconde fois';
  end if;

  if not has_function_privilege('authenticated','public.vente_reservation_encaisser(uuid,uuid,integer)','EXECUTE')
     or has_function_privilege('anon','public.vente_reservation_encaisser(uuid,uuid,integer)','EXECUTE') then
    raise exception 'Droits EXECUTE de l’encaissement réservation incorrects';
  end if;
end
$test$;

select '161_caisse_reservation_atomic_payment PASS' as resultat;
rollback;
