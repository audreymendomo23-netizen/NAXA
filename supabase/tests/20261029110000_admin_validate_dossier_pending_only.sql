-- NAXA — validation initiale des dossiers pharmacie : garde de l’état en attente.
-- Test structurel à exécuter sur une base de test après la migration correspondante.
begin;

do $test$
declare
  v_definition text;
  v_lower text;
  v_security_definer boolean;
  v_activation integer;
begin
  select pg_get_functiondef(p.oid), p.prosecdef
    into v_definition, v_security_definer
  from pg_proc p
  where p.oid = to_regprocedure('public.admin_valider_dossier_pharmacie(uuid,boolean)');

  if v_definition is null then
    raise exception 'RPC admin_valider_dossier_pharmacie absente';
  end if;
  v_lower := lower(v_definition);
  if v_security_definer is distinct from true
     or position('public.is_admin()' in v_lower) = 0
     or position('p_autorisations_verifiees' in v_lower) = 0 then
    raise exception 'La RPC doit conserver SECURITY DEFINER, l’attestation et le contrôle administrateur';
  end if;
  if position('v_pharmacie.actif is distinct from false' in v_lower) = 0
     or position('v_pharmacie.visible_recherche is distinct from false' in v_lower) = 0
     or position('v_link.actif is distinct from false' in v_lower) = 0
     or position('v_promoteur.actif is distinct from false' in v_lower) = 0 then
    raise exception 'La RPC doit exiger pharmacie, rattachement et Promoteur tous encore en attente';
  end if;
  if position('public.pharmacie_documents_recus' in v_lower) = 0
     or position('v_documents_recus.kyc is distinct from true' in v_lower) = 0
     or position('v_documents_recus.piece_existence_legale is distinct from true' in v_lower) = 0
     or position('v_documents_recus.registre_commerce is distinct from true' in v_lower) = 0
     or position('v_documents_recus.niu is distinct from true' in v_lower) = 0
     or position('v_documents_recus.attestation_non_redevance is distinct from true' in v_lower) = 0
     or position('v_documents_recus.plan_localisation is distinct from true' in v_lower) = 0
     or position('v_documents_recus.cni_promoteur is distinct from true' in v_lower) = 0
     or position('public.pharmacie_documents' in v_lower) = 0
     or position('v_latest_document_status is distinct from ''valide''' in v_lower) = 0
     or position('d.recu_le desc' in v_lower) = 0
     or position('d.version desc' in v_lower) = 0
     or position('d.id desc' in v_lower) = 0 then
    raise exception 'Les déclarations doivent être complètes et les dernières versions des six fichiers validées';
  end if;

  v_activation := position('set statut = ''active''' in v_lower);
  if v_activation = 0
     or position('v_pharmacie.actif is distinct from false' in v_lower) > v_activation
     or position('v_link.actif is distinct from false' in v_lower) > v_activation
     or position('v_promoteur.actif is distinct from false' in v_lower) > v_activation then
    raise exception 'Les gardes de dossier en attente doivent précéder toute réinitialisation commerciale';
  end if;
  if has_function_privilege('anon', 'public.admin_valider_dossier_pharmacie(uuid, boolean)', 'EXECUTE') then
    raise exception 'anon ne doit pas pouvoir valider les dossiers pharmacie';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_valider_dossier_pharmacie(uuid, boolean)', 'EXECUTE') then
    raise exception 'authenticated doit pouvoir appeler la RPC sous son contrôle interne admin';
  end if;
end
$test$;

rollback;
select 'admin_validate_pharmacy_pending_guard PASS (structurel)' as resultat;
