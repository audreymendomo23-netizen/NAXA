-- Le prédicat RLS et la vue invoker filtrent les assureurs actifs.
-- La colonne de normalisation demeure inaccessible au rôle anon.
grant select (id, nom, code, actif) on table public.assureurs to anon;
