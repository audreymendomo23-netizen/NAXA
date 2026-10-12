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
    OR p_action NOT IN ('check','attempt','fail','success') OR p_key_hash !~ '^[a-f0-9]{64}$'
    OR p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'NAXA rate limit: paramètres invalides';
  END IF;
  v_window := make_interval(secs => p_window_seconds);
  INSERT INTO public.tentatives_code(scope,key_hash,last_seen_at)
  VALUES(p_scope,p_key_hash,v_now)
  ON CONFLICT(scope,key_hash) DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at;
  SELECT * INTO r FROM public.tentatives_code t WHERE t.scope=p_scope AND t.key_hash=p_key_hash FOR UPDATE;
  IF p_action='success' THEN
    UPDATE public.tentatives_code SET failures=0, window_started_at=v_now, blocked_until=NULL,last_seen_at=v_now
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
  IF r.failures > p_limit THEN
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
  actif boolean NOT NULL DEFAULT true,
  installation_id text
);
ALTER TABLE public.appareils ADD COLUMN IF NOT EXISTS installation_id text;
CREATE UNIQUE INDEX IF NOT EXISTS appareils_user_installation_uidx ON public.appareils(utilisateur_id, installation_id);
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

-- Nettoyage des clés de limiteur inactives > 24 h; planifie un job si pg_cron est disponible.
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
DO $cleanup$
BEGIN
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
      EXECUTE 'CREATE EXTENSION pg_cron';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron unavailable; cleanup function remains callable: %', SQLERRM;
  END;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE 'SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = ''naxa-cleanup-tentatives-code''';
    EXECUTE 'SELECT cron.schedule(''naxa-cleanup-tentatives-code'', ''17 * * * *'', ''SELECT public.naxa_cleanup_tentatives_code();'')';
  END IF;
END
$cleanup$;


-- Applique une opération sous verrou transactionnel, avec déduplication et alerte de stock négatif.
CREATE OR REPLACE FUNCTION public.naxa_apply_offline_operation_v1(
  p_device_id uuid, p_operation_id uuid, p_type text, p_payload jsonb, p_created_at_ms bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $naxa_offline$
DECLARE
  d public.appareils%ROWTYPE;
  existing public.naxa_offline_operations%ROWTYPE;
  v_product uuid;
  v_quantity integer;
  v_current integer;
  v_status text;
  v_created timestamptz;
BEGIN
  SELECT * INTO d FROM public.appareils WHERE id=p_device_id FOR UPDATE;
  IF NOT FOUND OR NOT d.actif THEN RAISE EXCEPTION 'NAXA offline sync: appareil désactivé ou inconnu'; END IF;
  IF now()-coalesce(d.derniere_synchro,d.cree_le) > interval '7 days' THEN
    RAISE EXCEPTION 'NAXA offline sync: appareil expiré après 7 jours sans synchronisation';
  END IF;
  SELECT * INTO existing FROM public.naxa_offline_operations WHERE id=p_operation_id;
  IF FOUND THEN
    IF existing.appareil_id<>p_device_id THEN RAISE EXCEPTION 'NAXA offline sync: identifiant d’opération déjà utilisé'; END IF;
    RETURN jsonb_build_object('status','already_applied','operation_status',existing.statut);
  END IF;
  v_created:=to_timestamp(greatest(0,p_created_at_ms)::double precision/1000.0);
  IF p_type='note_caisse_test' THEN
    INSERT INTO public.naxa_offline_operations(id,appareil_id,pharmacie_id,utilisateur_id,type,payload,cree_le,statut)
    VALUES(p_operation_id,d.id,d.pharmacie_id,d.utilisateur_id,p_type,coalesce(p_payload,'{}'::jsonb),v_created,'appliquee');
    RETURN jsonb_build_object('status','applied');
  ELSIF p_type='stock_set_quantity' THEN
    v_product:=coalesce(nullif(p_payload->>'produit_id','')::uuid,nullif(p_payload->>'productId','')::uuid);
    v_quantity:=coalesce(nullif(p_payload->>'quantite','')::integer,nullif(p_payload->>'quantity','')::integer);
    IF v_product IS NULL OR v_quantity IS NULL THEN RAISE EXCEPTION 'NAXA offline sync: produit ou quantité manquant'; END IF;
    SELECT quantite INTO v_current FROM public.stocks WHERE pharmacie_id=d.pharmacie_id AND produit_id=v_product FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'NAXA offline sync: stock introuvable pour cette pharmacie'; END IF;
    v_status:=CASE WHEN v_quantity<0 THEN 'alerte_stock_negatif' ELSE 'appliquee' END;
    INSERT INTO public.naxa_offline_operations(id,appareil_id,pharmacie_id,utilisateur_id,type,payload,cree_le,statut)
    VALUES(p_operation_id,d.id,d.pharmacie_id,d.utilisateur_id,p_type,coalesce(p_payload,'{}'::jsonb),v_created,v_status);
    UPDATE public.stocks SET quantite=v_quantity,updated_at=now()
      WHERE pharmacie_id=d.pharmacie_id AND produit_id=v_product;
    IF v_quantity<0 THEN
      INSERT INTO public.naxa_offline_alertes(pharmacie_id,appareil_id,operation_id,type,message)
      VALUES(d.pharmacie_id,d.id,p_operation_id,'stock_negatif',
        'Stock négatif après synchronisation hors ligne : produit '||v_product::text||', quantité '||v_quantity::text);
    END IF;
    RETURN jsonb_build_object('status','applied','quantity',v_quantity,'alert',v_quantity<0);
  ELSE
    RAISE EXCEPTION 'NAXA offline sync: type d’opération non pris en charge: %',p_type;
  END IF;
END $naxa_offline$;
REVOKE ALL ON FUNCTION public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint) TO service_role;


COMMIT;
