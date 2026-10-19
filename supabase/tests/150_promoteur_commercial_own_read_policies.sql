-- NAXA 150 — vérification des politiques RLS de lecture commerciale.
do $test$
begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='conventions_promoteurs' and policyname='conventions_promoteur_own_read' and cmd='SELECT' and roles @> array['authenticated']::name[]) then
   raise exception '150.1 : lecture de sa convention absente';
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='abonnements_promoteurs' and policyname='abonnements_promoteur_own_read' and cmd='SELECT' and roles @> array['authenticated']::name[]) then
   raise exception '150.2 : lecture de son abonnement absente';
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='abonnement_promoteur_paiements' and policyname='abonnement_promoteur_paiements_own_read' and cmd='SELECT' and roles @> array['authenticated']::name[]) then
   raise exception '150.3 : lecture de son historique de paiements absente';
 end if;
 if has_table_privilege('anon','public.conventions_promoteurs','SELECT')
    or has_table_privilege('anon','public.abonnements_promoteurs','SELECT')
    or has_table_privilege('anon','public.abonnement_promoteur_paiements','SELECT') then
   raise exception '150.4 : anon ne doit pas lire les données commerciales';
 end if;
end
$test$;
select 'Vérification 150 — lecture commerciale Promoteur : PASS' as resultat;
