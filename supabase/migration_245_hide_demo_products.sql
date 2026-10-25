-- Masque les produits de démonstration historiques sans supprimer les lignes.
-- Les fiches non validées ne sont pas exposées par le catalogue public.
begin;

update public.produits
set fiche_validee = false,
    source_fiche = coalesce(source_fiche, 'masquage_donnees_demo'),
    fiche_maj = now()
where lower(coalesce(nom, '')) ~ '(^|[^[:alnum:]])(demo|démo|test|mock|exemple|fictif)([^[:alnum:]]|$)'
   or lower(coalesce(dci, '')) ~ '(^|[^[:alnum:]])(demo|démo|test|mock|exemple|fictif)([^[:alnum:]]|$)';

commit;
