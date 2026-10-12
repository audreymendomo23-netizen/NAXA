-- BROUILLON Preview uniquement. Ne pas exécuter sur Production sans validation.
-- Ajoute une colonne sans supprimer ni modifier les données existantes.
ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS code_pharmacie text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pharmacies'::regclass
      AND conname = 'pharmacies_code_pharmacie_format_chk'
  ) THEN
    ALTER TABLE public.pharmacies
      ADD CONSTRAINT pharmacies_code_pharmacie_format_chk
      CHECK (code_pharmacie IS NULL OR code_pharmacie ~ '^[0-9]{4}$') NOT VALID;
  END IF;
END $$;

-- Index unique uniquement pour les codes renseignés; plusieurs NULL sont permis.
CREATE UNIQUE INDEX IF NOT EXISTS pharmacies_code_pharmacie_uidx
  ON public.pharmacies (code_pharmacie)
  WHERE code_pharmacie IS NOT NULL;
