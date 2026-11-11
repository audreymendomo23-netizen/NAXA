begin;

do $test$
declare
  v_rpc text := lower(pg_get_functiondef(
    'public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text,jsonb)'::regprocedure
  ));
  v_claim_rpc text := lower(pg_get_functiondef(
    'public.naxa_promoteur_payment_add_reference(uuid,text,text,smallint,text,timestamptz,timestamptz,text)'::regprocedure
  ));
  v_guard text := lower(pg_get_functiondef('private.naxa_promoteur_valide(uuid)'::regprocedure));
  v_sync text := lower(pg_get_functiondef('public.synchroniser_validite_pharmacies()'::regprocedure));
  v_idx text;
begin
  if position('orange_money' in v_rpc)=0 or position('mtn_momo' in v_rpc)=0
     or position('virement' in v_rpc)>0 or position('depot_bancaire' in v_rpc)>0 then
    raise exception 'Seuls Orange Money et MTN Mobile Money doivent etre admis';
  end if;
  if position('verification_deadline_at' in v_rpc)=0
     or position('interval ''24 hours''' in v_rpc)=0 then
    raise exception 'La declaration doit ouvrir une fenetre de verification de 24 heures';
  end if;
  if position('reference_normalisee' in v_rpc)=0
     or position('naxa_promoteur_payment_reference_claims' in v_rpc)=0 then
    raise exception 'La reference principale doit etre revendiquee dans le registre global';
  end if;
  if position('provider_occurred_at' in v_claim_rpc)=0
     or position('sms_received_at' in v_claim_rpc)=0
     or position('verification_deadline_at' in v_claim_rpc)=0 then
    raise exception 'Le rattachement de date/heure operateur et reception SMS est absent';
  end if;
  select indexdef into v_idx from pg_indexes
  where schemaname='public' and indexname='naxa_promoteur_payment_reference_claims_unique';
  if v_idx is null or position('unique' in lower(v_idx))=0 then
    raise exception 'Le registre doit garantir l''unicite globale des references';
  end if;
  if position('verification_deadline_at' in v_claim_rpc)=0
     or position('existing.referencenormalisee' in v_claim_rpc)=0 then
    raise exception 'Le rapprochement secondaire doit rejeter les références déjà présentes dans les règlements historiques';
  end if;
  if position('verification_deadline_at' in v_guard)=0
     or position('en_attente' in v_guard)=0 then
    raise exception 'Le garde de validite doit respecter la tolerance de 24 heures';
  end if;
  if position('verification_deadline_at' in v_sync)=0
     or position('not exists' in v_sync)=0 then
    raise exception 'La synchronisation doit differer la suspension uniquement pendant la fenetre de verification';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'Le RPC de declaration est expose a authenticated';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.naxa_promoteur_payment_add_reference(uuid,text,text,smallint,text,timestamptz,timestamptz,text)',
    'EXECUTE'
  ) then
    raise exception 'Le RPC de reference secondaire est expose a authenticated';
  end if;
end
$test$;

rollback;
select 'Paiement Promoteur : 3 niveaux, unicite et tolerance 24 h — PASS' as resultat;
