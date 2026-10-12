-- Diagnostic en lecture seule : aucune donnée métier n'est modifiée.
-- Résultat : colonnes de pharmacies/profiles et clés étrangères reliant les deux.
SELECT
  'COLUMN'::text AS type_ligne,
  c.table_schema,
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  NULL::text AS contrainte,
  NULL::text AS table_referencee,
  NULL::text AS colonne_referencee
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('pharmacies', 'profiles')

UNION ALL

SELECT
  'FOREIGN_KEY'::text AS type_ligne,
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  NULL::text AS data_type,
  NULL::text AS is_nullable,
  tc.constraint_name AS contrainte,
  ccu.table_schema || '.' || ccu.table_name AS table_referencee,
  ccu.column_name AS colonne_referencee
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_catalog = tc.constraint_catalog
 AND kcu.constraint_schema = tc.constraint_schema
 AND kcu.constraint_name = tc.constraint_name
 AND kcu.table_schema = tc.table_schema
 AND kcu.table_name = tc.table_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_catalog = tc.constraint_catalog
 AND ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (tc.table_name IN ('pharmacies', 'profiles')
       OR ccu.table_name IN ('pharmacies', 'profiles'))
ORDER BY type_ligne, table_name, column_name;
