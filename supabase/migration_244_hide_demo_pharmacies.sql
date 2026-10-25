-- Masque les pharmacies clairement identifiées comme données de démonstration.
-- Conservation des enregistrements pour audit : aucune suppression physique.
-- Le motif utilise des mots entiers afin d'éviter de masquer un nom contenant
-- fortuitement la chaîne "test" (ex. "Protestant").
begin;

update public.pharmacies
set actif = false,
    visible_recherche = false,
    de_garde = false,
    archivee_le = coalesce(archivee_le, now())
where lower(coalesce(nom, '')) ~ '(^|[^[:alnum:]])(démo|demo|test|mock|exemple|fictif)([^[:alnum:]]|$)';

commit;
