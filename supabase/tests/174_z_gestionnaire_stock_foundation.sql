begin;
do $t$
begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='stocks_lots' and column_name='id') then raise exception 'Identifiant stable des lots absent'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='stocks_lots' and column_name='numero_lot') then raise exception 'Numéro de lot canonique absent'; end if;
 if to_regclass('public.fournisseurs') is null or to_regclass('public.commandes_fournisseurs') is null then raise exception 'Socle fournisseurs absent'; end if;
 if to_regclass('public.receptions_fournisseurs') is null or to_regclass('public.inventaires') is null or to_regclass('public.inventaire_lignes') is null then raise exception 'Socle réception/inventaire absent'; end if;
 if not exists(select 1 from pg_constraint where conname='profiles_fonction_interne_check') then raise exception 'Contrainte fonctions internes absente'; end if;
end;
$t$;
rollback;
