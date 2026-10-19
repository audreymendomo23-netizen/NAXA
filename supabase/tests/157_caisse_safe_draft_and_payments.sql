-- NAXA 157 — contrôles structurels du parcours Caisse.
begin;

do $test$
declare
  v_abandon text;
  v_encaisser text;
  v_fractionne text;
  v_atomic text;
  v_atomic_security boolean;
  v_actor_guard text;
  v_sale_guard text;
  v_session_guard text;
  v_session_trigger text;
  v_vente_trigger text;
  v_vente_insert_trigger text;
  v_line_trigger text;
  v_payment_trigger text;
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

  select pg_get_functiondef(p.oid), p.prosecdef
    into v_atomic, v_atomic_security
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='vente_encaisser_finaliser'
    and p.pronargs=2;

  if v_atomic is null or not v_atomic_security then
    raise exception 'RPC atomique d’encaissement absente ou non SECURITY DEFINER';
  end if;
  if position('statut' in lower(v_atomic))=0
     or position('public.vente_paiements' in v_atomic)=0
     or position('paid_at' in v_atomic)=0
     or position('auth.uid()' in v_atomic)=0
     or position('public.can_operate_pharmacy' in v_atomic)=0 then
    raise exception 'Contrôles d’identité, de périmètre ou finalisation atomique incomplets';
  end if;

  select pg_get_functiondef(p.oid)
    into v_actor_guard
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='naxa_caisse_actor_for_pharmacy' and p.pronargs=1;

  select pg_get_functiondef(p.oid)
    into v_sale_guard
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='naxa_guard_pos_vente_write' and p.pronargs=0;
  if v_sale_guard is null
     or position('for update' in lower(v_sale_guard))=0
     or position('created_by' in lower(v_sale_guard))=0
     or position('naxa_caisse_actor_for_pharmacy' in lower(v_sale_guard))=0
     or position('cs.ouvert_par' in lower(v_sale_guard))=0 then
    raise exception 'Garde de création/finalisation POS ou verrouillage de session incomplet';
  end if;


  select pg_get_functiondef(p.oid)
    into v_session_guard
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='naxa_guard_caisse_session_write' and p.pronargs=0;
  if v_session_guard is null
     or position('total_theorique' in v_session_guard)=0
     or position('total_compte' in v_session_guard)=0
     or position('public.vente_paiements' in v_session_guard)=0 then
    raise exception 'La clôture ne recalcule pas le rapprochement espèces côté base';
  end if;


  if v_actor_guard is null
     or position('pharmacie_id' in v_actor_guard)=0
     or position('fonction_interne' in v_actor_guard)=0
     or position('actif' in lower(v_actor_guard))=0 then
    raise exception 'Garde de rôle Caisse actif absente ou incomplète';
  end if;

  select pg_get_triggerdef(t.oid) into v_session_trigger
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='caisses_sessions'
    and t.tgname='trg_naxa_guard_caisse_session_write' and not t.tgisinternal;
  select pg_get_triggerdef(t.oid) into v_vente_trigger
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='ventes'
    and t.tgname='trg_naxa_guard_pos_vente_finalize' and not t.tgisinternal;
  select pg_get_triggerdef(t.oid) into v_vente_insert_trigger
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='ventes'
    and t.tgname='trg_naxa_guard_pos_vente_insert' and not t.tgisinternal;
  select pg_get_triggerdef(t.oid) into v_line_trigger
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='vente_lignes'
    and t.tgname='trg_naxa_guard_pos_line_write' and not t.tgisinternal;
  select pg_get_triggerdef(t.oid) into v_payment_trigger
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='vente_paiements'
    and t.tgname='trg_naxa_guard_pos_payment_write' and not t.tgisinternal;

  if v_session_trigger is null or v_vente_trigger is null or v_vente_insert_trigger is null
     or v_line_trigger is null or v_payment_trigger is null then
    raise exception 'Un des déclencheurs de protection du POS est absent';
  end if;

  if not has_function_privilege('authenticated','public.vente_brouillon_abandonner(uuid)','EXECUTE')
     or has_function_privilege('anon','public.vente_brouillon_abandonner(uuid)','EXECUTE') then
    raise exception 'Droits EXECUTE de la RPC d’abandon incorrects';
  end if;

  if not has_function_privilege('authenticated','public.vente_encaisser_finaliser(uuid,integer)','EXECUTE')
     or has_function_privilege('anon','public.vente_encaisser_finaliser(uuid,integer)','EXECUTE') then
    raise exception 'Droits EXECUTE de la RPC atomique d’encaissement incorrects';
  end if;


  if has_table_privilege('authenticated','public.caisses_sessions','INSERT')
     or has_table_privilege('authenticated','public.caisses_sessions','UPDATE')
     or has_table_privilege('authenticated','public.ventes','INSERT')
     or has_table_privilege('authenticated','public.ventes','UPDATE')
     or has_table_privilege('authenticated','public.vente_lignes','INSERT')
     or has_table_privilege('authenticated','public.vente_lignes','UPDATE')
     or has_table_privilege('authenticated','public.vente_paiements','INSERT')
     or has_table_privilege('authenticated','public.vente_paiements','UPDATE') then
    raise exception 'Les tables POS autorisent encore des mutations directes par le navigateur';
  end if;
end
$test$;

rollback;
