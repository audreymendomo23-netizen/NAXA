-- NAXA 187 — contrats de portée Assurance et annulation Caisse.
-- Les couvertures personnelles restent privées au client. La pharmacie lit
-- uniquement les snapshots et dossiers qui appartiennent à son périmètre RLS.
do $$
declare
  v_definition text;
  v_policy text;
begin
  if not coalesce((select relrowsecurity from pg_class where oid='public.assurance_reservation_snapshots'::regclass),false) then
    raise exception 'RLS des snapshots Assurance absente';
  end if;
  select qual into v_policy from pg_policies
  where schemaname='public' and tablename='assurance_reservation_snapshots'
    and policyname='assurance_snapshots_scope_read' and cmd='SELECT';
  if v_policy is null or position('can_access_pharmacy' in v_policy)=0 then
    raise exception 'Lecture des snapshots hors périmètre pharmacie';
  end if;

  if not coalesce((select relrowsecurity from pg_class where oid='public.dossiers_assurance'::regclass),false) then
    raise exception 'RLS des dossiers Assurance absente';
  end if;
  select qual into v_policy from pg_policies
  where schemaname='public' and tablename='dossiers_assurance'
    and policyname='dossiers_assurance_scope_read' and cmd='SELECT';
  if v_policy is null or position('can_access_pharmacy' in v_policy)=0 then
    raise exception 'Lecture des dossiers Assurance hors périmètre pharmacie';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='couvertures_assurance'
      and policyname='couvertures_client_read' and cmd='SELECT'
      and position('client_id' in coalesce(qual,''))>0
  ) then
    raise exception 'Les couvertures personnelles doivent rester filtrées par propriétaire';
  end if;
  if has_table_privilege('anon','public.assurance_reservation_snapshots','SELECT') is not true
    or has_table_privilege('anon','public.dossiers_assurance','SELECT') is not true then
    -- Table-level grants are harmless only when RLS rejects rows; the test
    -- requires that there is no unauthenticated API access path.
    if exists(select 1 from pg_policies where schemaname='public'
      and tablename in ('assurance_reservation_snapshots','dossiers_assurance')
      and 'anon'=any(roles)) then
      raise exception 'Lecture anonyme des dossiers/snapshots Assurance détectée';
    end if;
  end if;

  if not has_function_privilege('authenticated','public.vente_annulation_demander(uuid,text)','EXECUTE') then
    raise exception 'La fonction de demande d''annulation doit être accessible aux comptes authentifiés';
  end if;
  if has_function_privilege('anon','public.vente_annulation_demander(uuid,text)','EXECUTE') then
    raise exception 'Les comptes anon ne doivent pas demander une annulation';
  end if;

  select pg_get_functiondef('public.vente_annulation_demander(uuid,text)'::regprocedure)
    into v_definition;
  if position('created_by' in v_definition)=0
     or position('ne peut demander' in v_definition)=0 then
    raise exception 'Le contrôle serveur des ventes propres à la caisse est absent';
  end if;
end $$;

select '187_caisse_parcours_scope_assurances PASS' as resultat;
