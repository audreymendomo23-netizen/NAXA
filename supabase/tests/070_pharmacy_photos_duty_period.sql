-- Vérifie la présence des métadonnées photos et périodes de garde ajoutées en migration 070.
select count(*) = 8
from information_schema.columns
where table_schema = 'public'
  and table_name = 'pharmacies'
  and column_name in (
    'photo_path',
    'photo_source_url',
    'photo_licence',
    'photo_verifiee_le',
    'garde_debut',
    'garde_fin',
    'garde_source_url',
    'garde_verifiee_le'
  );

select exists (
  select 1
  from pg_constraint
  where conrelid = 'public.pharmacies'::regclass
    and conname = 'pharmacies_garde_periode_coherente'
    and contype = 'c'
);
