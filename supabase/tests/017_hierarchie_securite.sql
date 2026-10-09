-- NAXA PASS 5 — tests structurels et périmètre multi-pharmacie.
-- Exécuter après application contrôlée des migrations 015→017 sur un environnement de test.
-- Aucun compte réel ne doit être créé par ce fichier.

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='stocks'
      AND policyname='stocks_read'
  ) THEN RAISE EXCEPTION 'RLS stocks_read manquante'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='stocks'
      AND policyname='stocks_management_insert' AND cmd='INSERT'
  ) THEN RAISE EXCEPTION 'RLS stocks_management_insert manquante'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='stocks'
      AND policyname='stocks_caisse_update' AND cmd='UPDATE'
  ) THEN RAISE EXCEPTION 'RLS stocks_caisse_update manquante'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='stocks'
      AND policyname='stocks_management_delete' AND cmd='DELETE'
  ) THEN RAISE EXCEPTION 'RLS stocks_management_delete manquante'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='rapports'
      AND policyname='rapports_lecture'
  ) THEN RAISE EXCEPTION 'RLS rapports_lecture manquante'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profile_accreditations'
      AND policyname='profile_accreditations_parties'
  ) THEN RAISE EXCEPTION 'RLS accréditations manquante'; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='my_pharmacies'
  ) THEN RAISE EXCEPTION 'my_pharmacies manquante'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='can_access_pharmacy'
  ) THEN RAISE EXCEPTION 'can_access_pharmacy manquante'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='accrediter_profile'
  ) THEN RAISE EXCEPTION 'accrediter_profile manquante'; END IF;
END $$;

ROLLBACK;
