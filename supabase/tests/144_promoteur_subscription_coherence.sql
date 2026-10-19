-- NAXA 144 — garde de cohérence abonnement/convention.
do $test$
begin
 if to_regprocedure('public.verifier_abonnement_promoteur_coherence()') is null then raise exception '144.1 fonction de cohérence absente'; end if;
 if not exists(select 1 from pg_trigger where tgname='trg_verifier_abonnement_promoteur_coherence' and tgrelid='public.abonnements_promoteurs'::regclass and not tgisinternal) then raise exception '144.2 trigger de cohérence absent'; end if;
 if not (select tgenabled <> 'D' from pg_trigger where tgname='trg_verifier_abonnement_promoteur_coherence' and tgrelid='public.abonnements_promoteurs'::regclass and not tgisinternal) then raise exception '144.3 trigger de cohérence désactivé'; end if;
end
$test$;
select 'Vérification 144 — cohérence contrat Promoteur : PASS' as resultat;
