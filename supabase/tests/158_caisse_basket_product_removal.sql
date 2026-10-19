-- NAXA 158 — contrôles structurels du retrait de produit du panier.
begin;

do $test$
declare
  v_remove text;
  v_guard text;
  v_security boolean;
begin
  select pg_get_functiondef(p.oid),p.prosecdef
    into v_remove,v_security
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='vente_produit_retirer' and p.pronargs=2;

  if v_remove is null or not v_security then
    raise exception 'RPC de retrait absente ou non SECURITY DEFINER';
  end if;
  if position('stocks_lots' in lower(v_remove))=0
     or position('public.stocks' in lower(v_remove))=0
     or position('vente_recalculer_totaux' in lower(v_remove))=0
     or position('set_config' in lower(v_remove))=0
     or position('auth.uid()' in lower(v_remove))=0
     or position('created_by' in lower(v_remove))=0
     or position('ouvert_par' in lower(v_remove))=0
     or position('fonction_interne' in lower(v_remove))=0 then
    raise exception 'Contrôles de propriété, session ou restitution de stock incomplets';
  end if;

  select pg_get_functiondef(p.oid)
    into v_guard
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='naxa_guard_pos_line_write' and p.pronargs=0;

  if v_guard is null
     or position('current_setting' in lower(v_guard))=0
     or position('remove_line' in lower(v_guard))=0
     or position('cs.ouvert_par' in lower(v_guard))=0 then
    raise exception 'Le déclencheur ne réserve pas la suppression à la RPC autorisée';
  end if;

  if not has_function_privilege('authenticated','public.vente_produit_retirer(uuid,uuid)','EXECUTE')
     or has_function_privilege('anon','public.vente_produit_retirer(uuid,uuid)','EXECUTE') then
    raise exception 'Droits EXECUTE de la RPC de retrait incorrects';
  end if;

  if has_table_privilege('authenticated','public.vente_lignes','DELETE')
     or has_table_privilege('anon','public.vente_lignes','DELETE') then
    raise exception 'Suppression directe de lignes POS encore autorisée';
  end if;
end
$test$;

rollback;
