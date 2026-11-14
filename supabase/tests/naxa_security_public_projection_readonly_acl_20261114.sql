-- Contrôles ACL en lecture seule sur les vues de projection NAXA.
DO $test$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'marketplace_assureurs',
    'marketplace_assurance_conventions',
    'medicaments_cima_photos_public'
  ]
  LOOP
    IF NOT has_table_privilege('anon',format('public.%I',v_name),'SELECT')
       OR NOT has_table_privilege('authenticated',format('public.%I',v_name),'SELECT') THEN
      RAISE EXCEPTION 'La lecture API attendue est absente sur %', v_name;
    END IF;
    IF has_table_privilege('anon',format('public.%I',v_name),'INSERT')
       OR has_table_privilege('anon',format('public.%I',v_name),'UPDATE')
       OR has_table_privilege('anon',format('public.%I',v_name),'DELETE')
       OR has_table_privilege('authenticated',format('public.%I',v_name),'INSERT')
       OR has_table_privilege('authenticated',format('public.%I',v_name),'UPDATE')
       OR has_table_privilege('authenticated',format('public.%I',v_name),'DELETE') THEN
      RAISE EXCEPTION 'Une vue de projection expose encore une mutation : %', v_name;
    END IF;
  END LOOP;

  IF has_table_privilege('anon','public.suivi_professional_weekly_availability','SELECT')
     OR has_table_privilege('anon','public.suivi_professionals','SELECT') THEN
    RAISE EXCEPTION 'Une table de suivi professionnel reste directement lisible par anon';
  END IF;
END
$test$;

SELECT true AS naxa_public_projection_acl_pass;
