-- NAXA 160 — test structurel des transitions de réservation Pharmacie.
begin;

do $test$
declare
  v_transition text;
  v_public_rpc text;
  v_my_pharmacy text;
begin
  if to_regclass('public.reservations') is null then
    raise exception 'Table public.reservations absente';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='reservations' and column_name='mode'
  ) then
    raise exception 'Colonne reservations.mode absente';
  end if;

  select pg_get_functiondef(p.oid)
    into v_transition
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private'
    and p.proname='set_reservation_status'
    and p.pronargs=2;

  if v_transition is null
     or position('transition_ok' in lower(v_transition))=0
     or position('r.statut = ''payee''' in lower(v_transition))=0
     or position('p_statut = ''retiree''' in lower(v_transition))=0
     or position('public.restore_stock' in lower(v_transition))=0
     or position('naxa_scope_allows' in lower(v_transition))=0 then
    raise exception 'Garde de transition, scope ou restitution de stock incomplète';
  end if;

  select pg_get_functiondef(p.oid)
    into v_public_rpc
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='set_reservation_status'
    and p.pronargs=2;

  if v_public_rpc is null
     or position('private.set_reservation_status' in lower(v_public_rpc))=0 then
    raise exception 'La RPC publique ne délègue plus à la garde privée';
  end if;

  if not has_function_privilege('authenticated','public.set_reservation_status(uuid,public.resa_statut)','EXECUTE')
     or has_function_privilege('anon','public.set_reservation_status(uuid,public.resa_statut)','EXECUTE') then
    raise exception 'Droits EXECUTE de la RPC de réservation incorrects';
  end if;

  select pg_get_functiondef(p.oid)
    into v_my_pharmacy
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='my_pharmacie' and p.pronargs=0;

  if v_my_pharmacy is null
     or position('' || chr(39) || 'caisse' || chr(39) in lower(v_my_pharmacy))=0 then
    raise exception 'Le profil Caisse n''est pas reconnu dans le périmètre pharmacie';
  end if;
end
$test$;

select '160_reservation_transition_guard PASS' as resultat;
rollback;
