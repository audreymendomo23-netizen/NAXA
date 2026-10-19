-- NAXA 157 — contrôles structurels du parcours Caisse.
begin;

do $test$
declare
  v_abandon text;
  v_encaisser text;
  v_fractionne text;
  v_abandon_security boolean;
  v_encaisser_security boolean;
begin
  select pg_get_functiondef(p.oid), p.prosecdef
    into v_abandon, v_abandon_security
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='vente_brouillon_abandonner'
    and p.pronargs=1;

  if v_abandon is null then raise exception 'RPC vente_brouillon_abandonner absente'; end if;
  if not v_abandon_security then raise exception 'Abandon de panier doit être SECURITY DEFINER'; end if;
  if position('auth.uid()' in v_abandon)=0
     or position('statut' in lower(v_abandon))=0
     or position('created_by' in v_abandon)=0
     or position('stocks_lots' in v_abandon)=0
     or position('public.stocks' in v_abandon)=0
     or position('public.can_operate_pharmacy' in v_abandon)=0 then
    raise exception 'La garde ou la restitution atomique du stock du panier est incomplète';
  end if;

  select pg_get_functiondef(p.oid), p.prosecdef
    into v_encaisser, v_encaisser_security
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='vente_encaisser'
    and p.pronargs=4;

  if v_encaisser is null or not v_encaisser_security then
    raise exception 'RPC vente_encaisser absente ou non SECURITY DEFINER';
  end if;
  if position('orange_money' in lower(v_encaisser))=0
     or position('mtn_momo' in lower(v_encaisser))=0
     or position('mobile_money' in lower(v_encaisser))=0
     or position('aucune confirmation opérateur' in lower(v_encaisser))=0 then
    raise exception 'Le blocage des paiements électroniques non vérifiés manque';
  end if;

  select pg_get_functiondef(p.oid)
    into v_fractionne
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='vente_ajouter_paiement'
    and p.pronargs=4;

  if v_fractionne is null
     or position('aucune confirmation opérateur' in lower(v_fractionne))=0 then
    raise exception 'La voie de paiement fractionné historique contourne le blocage';
  end if;

  if not has_function_privilege('authenticated','public.vente_brouillon_abandonner(uuid)','EXECUTE')
     or has_function_privilege('anon','public.vente_brouillon_abandonner(uuid)','EXECUTE') then
    raise exception 'Droits EXECUTE de la RPC d’abandon incorrects';
  end if;
end
$test$;

rollback;
