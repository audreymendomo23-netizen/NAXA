begin;
do $t$
begin
 if to_regprocedure('public.naxa_stock_manager_actor(uuid)') is null then raise exception 'Fonction de périmètre ERP absente'; end if;
 if to_regprocedure('public.fournisseur_commande_envoyer(uuid)') is null then raise exception 'RPC d’envoi commande fournisseur absente'; end if;
 if has_function_privilege('anon','public.naxa_stock_manager_actor(uuid)','EXECUTE') then raise exception 'Fonction de périmètre accessible à anon'; end if;
 if has_table_privilege('authenticated','public.receptions_fournisseurs','INSERT') then raise exception 'Écriture directe des réceptions encore accordée'; end if;
 if has_table_privilege('authenticated','public.inventaire_lignes','UPDATE') then raise exception 'Écriture directe des lignes inventaire encore accordée'; end if;
 if has_table_privilege('authenticated','public.commandes_fournisseurs','UPDATE') then raise exception 'Transition commande directe encore accordée'; end if;
 if has_table_privilege('authenticated','public.commandes_fournisseurs_lignes','DELETE') then raise exception 'Suppression de lignes commande encore accordée'; end if;
end;
$t$;
rollback;
