-- NAXA BROUILLON PREVIEW — script idempotent, aucun changement Production.
-- Schéma observé : public.pharmacies(id, nom, ...), public.profiles(id, username, pharmacie_id, actif).
-- Le script s'arrête explicitement si la relation attendue n'est pas présente ou est ambiguë.
BEGIN;

DO $$
DECLARE
  v_pharmacy_table regclass;
  v_id_col text;
  v_name_col text;
  v_profile_link text;
  v_link_count integer;
BEGIN
  SELECT c.oid::regclass INTO v_pharmacy_table
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='pharmacies' AND c.relkind IN ('r','p');
  IF v_pharmacy_table IS NULL THEN
    RAISE EXCEPTION 'NAXA schema check: table public.pharmacies introuvable; aucune modification poursuivie.';
  END IF;
  SELECT column_name INTO v_id_col FROM information_schema.columns
   WHERE table_schema='public' AND table_name='pharmacies' AND column_name='id' AND data_type='uuid';
  SELECT column_name INTO v_name_col FROM information_schema.columns
   WHERE table_schema='public' AND table_name='pharmacies' AND column_name='nom';
  IF v_id_col IS NULL OR v_name_col IS NULL THEN
    RAISE EXCEPTION 'NAXA schema check: public.pharmacies doit contenir id UUID et nom.';
  END IF;
  SELECT count(*), min(kcu.column_name) INTO v_link_count, v_profile_link
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_schema=kcu.constraint_schema AND tc.constraint_name=kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_schema=ccu.constraint_schema AND tc.constraint_name=ccu.constraint_name
  WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
    AND tc.table_name='profiles' AND ccu.table_schema='public'
    AND ccu.table_name='pharmacies' AND ccu.column_name='id';
  IF v_link_count <> 1 OR v_profile_link IS DISTINCT FROM 'pharmacie_id' THEN
    RAISE EXCEPTION 'NAXA schema check: liaison profiles -> pharmacies absente ou ambiguë (attendu profiles.pharmacie_id -> pharmacies.id).';
  END IF;
END $$;

ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS code_pharmacie text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.pharmacies'::regclass AND conname='pharmacies_code_pharmacie_format_chk') THEN
    ALTER TABLE public.pharmacies ADD CONSTRAINT pharmacies_code_pharmacie_format_chk
      CHECK (code_pharmacie IS NULL OR code_pharmacie ~ '^[0-9]{4}$') NOT VALID;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS pharmacies_code_pharmacie_uidx
  ON public.pharmacies(code_pharmacie) WHERE code_pharmacie IS NOT NULL;

-- Attribution uniquement aux lignes sans code; codes existants ne sont jamais modifiés.
DO $$
DECLARE p record; v_code text; v_tries integer;
BEGIN
  FOR p IN SELECT id FROM public.pharmacies WHERE code_pharmacie IS NULL ORDER BY id LOOP
    v_tries := 0;
    LOOP
      v_code := (1000 + floor(random()*9000))::integer::text;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.pharmacies WHERE code_pharmacie=v_code);
      v_tries := v_tries + 1;
      IF v_tries >= 20000 THEN RAISE EXCEPTION 'NAXA code allocation: espace de codes 4 chiffres insuffisant; transaction annulée.'; END IF;
    END LOOP;
    UPDATE public.pharmacies SET code_pharmacie=v_code WHERE id=p.id AND code_pharmacie IS NULL;
  END LOOP;
END $$;
ALTER TABLE public.pharmacies VALIDATE CONSTRAINT pharmacies_code_pharmacie_format_chk;

CREATE TABLE IF NOT EXISTS public.tentatives_code (
  scope text NOT NULL,
  key_hash text NOT NULL,
  failures integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  block_seconds integer NOT NULL DEFAULT 30,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(scope,key_hash),
  CONSTRAINT tentatives_code_scope_chk CHECK (scope IN ('ip_code','code','ip_login','login_user','ip_password','password_user')),
  CONSTRAINT tentatives_code_failures_chk CHECK (failures >= 0),
  CONSTRAINT tentatives_code_block_seconds_chk CHECK (block_seconds BETWEEN 30 AND 900)
);
ALTER TABLE public.tentatives_code ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tentatives_code FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tentatives_code TO service_role;

CREATE OR REPLACE FUNCTION public.naxa_rate_limit_v1(
  p_scope text, p_key_hash text, p_action text, p_limit integer, p_window_seconds integer,
  p_base_block_seconds integer DEFAULT 30, p_max_block_seconds integer DEFAULT 900
) RETURNS TABLE(allowed boolean, retry_after integer, failures integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.tentatives_code%ROWTYPE; v_now timestamptz:=clock_timestamp(); v_block integer; v_window interval;
BEGIN
  IF p_scope NOT IN ('ip_code','code','ip_login','login_user','ip_password','password_user')
    OR p_action NOT IN ('check','fail','success') OR p_key_hash !~ '^[a-f0-9]{64}$'
    OR p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'NAXA rate limit: paramètres invalides';
  END IF;
  v_window := make_interval(secs => p_window_seconds);
  INSERT INTO public.tentatives_code(scope,key_hash,last_seen_at)
  VALUES(p_scope,p_key_hash,v_now)
  ON CONFLICT(scope,key_hash) DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at;
  SELECT * INTO r FROM public.tentatives_code t WHERE t.scope=p_scope AND t.key_hash=p_key_hash FOR UPDATE;
  IF p_action='success' THEN
    UPDATE public.tentatives_code SET failures=0, window_started_at=v_now, blocked_until=NULL, block_seconds=p_base_block_seconds,last_seen_at=v_now
    WHERE scope=p_scope AND key_hash=p_key_hash;
    RETURN QUERY SELECT true,0,0; RETURN;
  END IF;
  IF r.blocked_until IS NOT NULL AND r.blocked_until > v_now THEN
    RETURN QUERY SELECT false, greatest(1,ceil(extract(epoch FROM r.blocked_until-v_now))::integer),r.failures; RETURN;
  END IF;
  IF p_action='check' THEN
    RETURN QUERY SELECT true,0,r.failures; RETURN;
  END IF;
  IF r.window_started_at + v_window <= v_now THEN
    r.failures:=0; r.window_started_at:=v_now;
  END IF;
  r.failures:=r.failures+1;
  IF r.failures >= p_limit THEN
    v_block := least(p_max_block_seconds, greatest(p_base_block_seconds, r.block_seconds));
    UPDATE public.tentatives_code SET failures=r.failures,window_started_at=r.window_started_at,
      blocked_until=v_now+make_interval(secs=>v_block),
      block_seconds=least(p_max_block_seconds, greatest(p_base_block_seconds,r.block_seconds*2)),last_seen_at=v_now
    WHERE scope=p_scope AND key_hash=p_key_hash;
    RETURN QUERY SELECT false,v_block,r.failures; RETURN;
  END IF;
  UPDATE public.tentatives_code SET failures=r.failures,window_started_at=r.window_started_at,blocked_until=NULL,last_seen_at=v_now
  WHERE scope=p_scope AND key_hash=p_key_hash;
  RETURN QUERY SELECT true,0,r.failures;
END $$;
REVOKE ALL ON FUNCTION public.naxa_rate_limit_v1(text,text,text,integer,integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.naxa_rate_limit_v1(text,text,text,integer,integer,integer,integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.appareils (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacie_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  utilisateur_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nom text NOT NULL CHECK (length(trim(nom)) BETWEEN 1 AND 100),
  jeton_hash text NOT NULL UNIQUE,
  cree_le timestamptz NOT NULL DEFAULT now(),
  derniere_synchro timestamptz,
  actif boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS appareils_pharmacie_idx ON public.appareils(pharmacie_id);
CREATE INDEX IF NOT EXISTS appareils_utilisateur_idx ON public.appareils(utilisateur_id);
ALTER TABLE public.appareils ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.appareils FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appareils TO service_role;

CREATE TABLE IF NOT EXISTS public.naxa_offline_operations (
  id uuid PRIMARY KEY,
  appareil_id uuid NOT NULL REFERENCES public.appareils(id) ON DELETE CASCADE,
  pharmacie_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  utilisateur_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  cree_le timestamptz NOT NULL DEFAULT now(),
  statut text NOT NULL DEFAULT 'appliquee' CHECK (statut IN ('appliquee','alerte_stock_negatif'))
);
ALTER TABLE public.naxa_offline_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.naxa_offline_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.naxa_offline_operations TO service_role;

CREATE TABLE IF NOT EXISTS public.naxa_offline_alertes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacie_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  appareil_id uuid REFERENCES public.appareils(id) ON DELETE SET NULL,
  operation_id uuid NOT NULL REFERENCES public.naxa_offline_operations(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  traitee boolean NOT NULL DEFAULT false
);
ALTER TABLE public.naxa_offline_alertes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.naxa_offline_alertes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.naxa_offline_alertes TO service_role;

-- Nettoyage périodique manuel via SQL Editor; ne supprime que des clés de limiteur inactives > 24 h.
CREATE OR REPLACE FUNCTION public.naxa_cleanup_tentatives_code()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n integer;
BEGIN
 DELETE FROM public.tentatives_code WHERE last_seen_at < now()-interval '24 hours';
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.naxa_cleanup_tentatives_code() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.naxa_cleanup_tentatives_code() TO service_role;

COMMIT;
