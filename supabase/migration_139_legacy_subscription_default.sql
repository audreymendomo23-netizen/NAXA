-- NAXA 139 — restaurer le défaut canonique du contrat legacy abonnements.
-- Alignement avec migration_001 : les fixtures et les créations compatibles n'ont pas
-- à fournir explicitement la formule lorsque le produit essentiel est la valeur standard.
alter table public.abonnements alter column formule set default 'essentiel';
