-- NAXA 189 — tests structurels, à exécuter dans la base de tests après migration 189.
begin;
do $test$
begin
  if to_regclass('public.reservation_statut_historique') is null then
    raise exception 'Table reservation_statut_historique absente';
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_reservation_statut_historique_insert' and not tgisinternal) then
    raise exception 'Trigger initial historique absent';
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_reservation_statut_historique_update' and not tgisinternal) then
    raise exception 'Trigger statut historique absent';
  end if;
  if to_regprocedure('public.notifier_reservations_expirant_30m()') is null then
    raise exception 'Fonction rappel 30 min absente';
  end if;
  if to_regclass('public.notifications_reservation_expiry_once_uq') is null then
    raise exception 'Index anti-doublon du rappel absent';
  end if;
  if has_function_privilege('anon','public.notifier_reservations_expirant_30m()','EXECUTE')
     or has_function_privilege('authenticated','public.notifier_reservations_expirant_30m()','EXECUTE') then
    raise exception 'Fonction ordonnanceur accessible aux rôles applicatifs';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='reservation_statut_historique'
      and policyname='reservation_historique_participants_read'
  ) then raise exception 'RLS historique participants absent'; end if;
end;
$test$;
rollback;
