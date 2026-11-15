-- Replay regression: NAXA retains no commission from delivery fees.
do $test$
declare
  v_check_commission text;
  v_check_balance text;
  v_finalizer text;
  v_report text;
begin
  select pg_get_constraintdef(oid)
    into v_check_commission
  from pg_constraint
  where conrelid = 'public.naxa_delivery_commission_ledger'::regclass
    and conname = 'naxa_delivery_commission_ledger_commission_naxa_check';

  if v_check_commission is null or position('commission_naxa = 0' in v_check_commission) = 0 then
    raise exception 'Le registre n'impose pas une commission NAXA égale à zéro';
  end if;

  select pg_get_constraintdef(oid)
    into v_check_balance
  from pg_constraint
  where conrelid = 'public.naxa_delivery_commission_ledger'::regclass
    and conname = 'naxa_delivery_commission_ledger_solde_livraison_check';

  if v_check_balance is null or position('solde_livraison = frais_livraison_client' in v_check_balance) = 0 then
    raise exception 'Le registre ne crédite pas 100 %% des frais au service de livraison';
  end if;

  select pg_get_functiondef('private.naxa_delivery_finalize_if_confirmed(uuid)'::regprocedure)
    into v_finalizer;

  if position('v_r.frais_livraison, 0, v_r.frais_livraison' in v_finalizer) = 0 then
    raise exception 'La clôture ne verse pas 100 %% des frais au service de livraison';
  end if;
  if position('between 1500 and 20000' in v_finalizer) = 0 then
    raise exception 'La clôture ne couvre pas le barème livraison technique jusqu''à 20 000 FCFA';
  end if;

  if exists (
    select 1 from pg_trigger
    where tgname = 'trg_naxa_delivery_commission_monthly_settlement'
      and not tgisinternal
  ) then
    raise exception 'Le trigger de commission sur abonnement est encore présent';
  end if;

  if to_regprocedure('private.naxa_delivery_sync_subscription_commission_settlement()') is not null then
    raise exception 'La fonction de cumul de commission sur abonnement subsiste';
  end if;

  if has_function_privilege('anon',
      'public.naxa_delivery_fees_report(date,date,uuid)'::regprocedure, 'EXECUTE')
     or not has_function_privilege('authenticated',
      'public.naxa_delivery_fees_report(date,date,uuid)'::regprocedure, 'EXECUTE') then
    raise exception 'ACL du rapport de frais incorrecte';
  end if;

  if exists (
    select 1 from public.naxa_delivery_commission_ledger
    where commission_naxa <> 0
       or solde_livraison <> frais_livraison_client
  ) then
    raise exception 'Une ligne du registre conserve une commission non nulle';
  end if;
end
$test$;

select 'NAXA delivery commission: 0; full client fee allocated to delivery service: PASS' as result;
