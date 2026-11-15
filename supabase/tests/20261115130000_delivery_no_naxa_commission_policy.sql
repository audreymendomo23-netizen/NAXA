-- Replay regression: NAXA retains no commission from delivery fees.
do $test$
declare
  v_check_commission text;
  v_check_balance text;
  v_finalizer text;
  v_report jsonb;
begin
  select pg_get_constraintdef(oid)
    into v_check_commission
  from pg_constraint
  where conrelid = 'public.naxa_delivery_commission_ledger'::regclass
    and conname = 'naxa_delivery_commission_ledger_commission_naxa_check';

  if v_check_commission is null or position('commission_naxa = 0' in v_check_commission) = 0 then
    raise exception $msg$Le registre n'impose pas une commission NAXA égale à zéro$msg$;
  end if;

  select pg_get_constraintdef(oid)
    into v_check_balance
  from pg_constraint
  where conrelid = 'public.naxa_delivery_commission_ledger'::regclass
    and conname = 'naxa_delivery_commission_ledger_solde_livraison_check';

  if v_check_balance is null or position('solde_livraison = frais_livraison_client' in v_check_balance) = 0 then
    raise exception $msg$Le registre ne crédite pas 100 %% des frais au service de livraison$msg$;
  end if;

  select pg_get_functiondef('private.naxa_delivery_finalize_if_confirmed(uuid)'::regprocedure)
    into v_finalizer;

  if position('v_r.frais_livraison, 0, v_r.frais_livraison' in v_finalizer) = 0 then
    raise exception $msg$La clôture ne verse pas 100 %% des frais au service de livraison$msg$;
  end if;
  if position('between 1500 and 20000' in v_finalizer) = 0 then
    raise exception $msg$La clôture ne couvre pas le barème livraison technique jusqu'à 20 000 FCFA$msg$;
  end if;

  if exists (
    select 1 from pg_trigger
    where tgname = 'trg_naxa_delivery_commission_monthly_settlement'
      and not tgisinternal
  ) then
    raise exception $msg$Le trigger de commission sur abonnement est encore présent$msg$;
  end if;

  if to_regprocedure('private.naxa_delivery_sync_subscription_commission_settlement()') is not null then
    raise exception $msg$La fonction de cumul de commission sur abonnement subsiste$msg$;
  end if;

  if has_function_privilege('anon',
      'public.naxa_delivery_fees_report(date,date,uuid)'::regprocedure, 'EXECUTE')
     or not has_function_privilege('authenticated',
      'public.naxa_delivery_fees_report(date,date,uuid)'::regprocedure, 'EXECUTE') then
    raise exception $msg$ACL du rapport de frais incorrecte$msg$;
  end if;

  if exists (
    select 1 from public.naxa_delivery_commission_ledger
    where commission_naxa <> 0
       or solde_livraison <> frais_livraison_client
  ) then
    raise exception $msg$Une ligne du registre conserve une commission non nulle$msg$;
  end if;

  perform set_config('request.jwt.claim.sub', '5bff6417-ebd2-4c2f-b675-424632fa43a4', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  v_report := public.naxa_delivery_fees_report(current_date, current_date, null);
  if (v_report->'totaux'->>'retenue_naxa')::integer <> 0 then
    raise exception $msg$Le rapport Admin doit afficher une retenue NAXA nulle$msg$;
  end if;
  if (v_report->'totaux'->>'frais_clients')::integer <> 0
     or (v_report->'totaux'->>'montant_affecte_service')::integer <> 0 then
    raise exception $msg$Le rapport doit rester cohérent lorsque le registre est vide$msg$;
  end if;
end
$test$;

select 'NAXA delivery commission: 0; full client fee allocated to delivery service: PASS' as result;
