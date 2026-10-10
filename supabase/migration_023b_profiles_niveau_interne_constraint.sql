-- NAXA 023b — retirer le contrôle historique niveau_interne 0..3.
-- migration_023 définit déjà la contrainte canonique nullable 1..4 ; conserver les deux
-- rend impossible le niveau 4 requis pour le Client dans le modèle N0..N4.
alter table public.profiles drop constraint if exists profiles_niveau_interne_check;
