-- Vérification transactionnelle de la chaîne : événement valide puis altération simulée.
begin;

do $audit_chain$
declare
  v_pharmacie uuid;
  v_sequence bigint;
  v_ok boolean;
begin
  select id into v_pharmacie from public.pharmacies order by id limit 1;
  if v_pharmacie is null then
    raise exception 'FAIL: aucune pharmacie fixture disponible';
  end if;

  perform public.compta_auditer(
    v_pharmacie, null, 'test_etape8_chain_valid', 'test', 'fixture-valid',
    'succes', 'test transactionnel sans donnée personnelle'
  );

  v_ok := public.compta_verifier_audit(v_pharmacie);
  if v_ok is distinct from true then
    raise exception 'FAIL: la chaîne valide est refusée';
  end if;

  select derniere_sequence into v_sequence
  from public.compta_audit_tete where pharmacie_id = v_pharmacie;

  insert into public.compta_audit(
    pharmacie_id, sequence_no, acteur_id, action, objet_type, objet_id,
    resultat, motif, horodatage, previous_hash, hash_payload, event_hash
  ) values (
    v_pharmacie, v_sequence + 1, null, 'test_etape8_chain_corrupt', 'test',
    'fixture-corrupt', 'succes', 'fixture de corruption', now(),
    repeat('0', 64),
    jsonb_build_object('pharmacie_id', v_pharmacie, 'sequence_no', v_sequence + 1, 'action', 'valeur altérée'),
    repeat('0', 64)
  );

  update public.compta_audit_tete
  set derniere_sequence = v_sequence + 1,
      dernier_hash = repeat('0', 64),
      updated_at = now()
  where pharmacie_id = v_pharmacie;

  v_ok := public.compta_verifier_audit(v_pharmacie);
  if v_ok is distinct from false then
    raise exception 'FAIL: la chaîne altérée a été acceptée';
  end if;
end
$audit_chain$;

select 'PASS 168_compta_audit_chain_integrity' as result;
rollback;
