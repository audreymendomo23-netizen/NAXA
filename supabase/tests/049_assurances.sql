-- NAXA ERP-007/008 — Registre des substances contrôlées + assurances
do $$
begin
 if to_regclass('public.registre_substances_controlees') is null then raise exception 'registre_substances_controlees absent (migration 049)'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='registre_substances_controlees' and column_name='ordonnancier_id') then raise exception 'liaison ordonnancier du registre absente'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='registre_substances_controlees' and column_name='enregistre_par') then raise exception 'acteur du registre absent'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='assureurs') then raise exception 'assureurs absent'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='couvertures_assurance') then raise exception 'couvertures_assurance absente'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='dossiers_assurance') then raise exception 'dossiers_assurance absent'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='dossiers_assurance' and column_name='vente_id') then raise exception 'liaison vente absente'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='dossiers_assurance' and policyname='dossiers_assurance_scope_read') then raise exception 'RLS dossier absente'; end if;
 if has_table_privilege('authenticated','public.dossiers_assurance','INSERT') then raise exception 'INSERT direct dossier interdit'; end if;
end $$;

select '049_assurances PASS' as resultat;
