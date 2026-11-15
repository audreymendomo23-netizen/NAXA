-- Fix the assurance accounting event idempotence conflict target to match the actual unique key.
begin;

create or replace function public.assurance_confirmer_prise_en_charge(
  p_dossier uuid,
  p_reference text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_d public.dossiers_assurance%rowtype;
  v_s public.assurance_reservation_snapshots%rowtype;
begin
  select * into v_d
  from public.dossiers_assurance
  where id=p_dossier
  for update;

  if not found or not private.naxa_scope_allows(v_uid,v_d.pharmacie_id,'PHARMACIE')
     or private.naxa_business_function(v_uid) not in ('promoteur','pharmacien','responsable','caisse') then
    raise exception 'Dossier inaccessible ou poste non autorisé';
  end if;

  select * into v_s
  from public.assurance_reservation_snapshots
  where reservation_id=v_d.reservation_id
  for update;

  if not found or not v_s.valide_client or v_s.controle_documents_statut<>'conforme' then
    raise exception 'Accord client et contrôle conforme des justificatifs obligatoires';
  end if;

  if exists(
    select 1 from public.assurance_montant_propositions p
    where p.dossier_id=v_d.id and p.statut='proposee'
  ) then
    raise exception 'Une proposition de montant attend encore la décision du Client';
  end if;

  if v_d.statut<>'soumis' then
    raise exception 'Dossier non soumis ou déjà traité';
  end if;

  update public.dossiers_assurance
  set statut='accepte',
      reference_externe=nullif(trim(coalesce(p_reference,'')), ''),
      traite_at=now()
  where id=v_d.id;

  insert into public.assurance_evenements(
    pharmacie_id,reservation_id,dossier_id,assureur_id,acteur_id,type,montant_fcfa,reference
  ) values (
    v_d.pharmacie_id,v_d.reservation_id,v_d.id,v_s.assureur_id,v_uid,
    'prise_en_charge_confirmee',
    round(v_d.montant_prise_en_charge)::bigint,
    nullif(trim(coalesce(p_reference,'')), '')
  );

  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,donnees,statut
  ) values (
    v_d.pharmacie_id,'assurance_prise_en_charge','dossier_assurance',v_d.id::text,
    'assurance-prise-en-charge:'||v_d.id::text,now(),
    jsonb_build_object(
      'date_comptable',current_date::text,
      'montant_fcfa',round(v_d.montant_prise_en_charge)::bigint,
      'reference_source',coalesce(nullif(trim(coalesce(p_reference,'')),''),v_d.id::text),
      'dossier_id',v_d.id::text,
      'assureur_id',v_s.assureur_id::text
    ),
    'a_traiter'
  ) on conflict (pharmacie_id,cle_idempotence) do nothing;
end;
$function$;

revoke all on function public.assurance_confirmer_prise_en_charge(uuid,text) from public,anon;
grant execute on function public.assurance_confirmer_prise_en_charge(uuid,text) to authenticated,service_role;

commit;
