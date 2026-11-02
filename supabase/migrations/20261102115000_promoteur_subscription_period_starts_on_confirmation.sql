-- Confirmation d'un règlement : la nouvelle période commence à la date réelle de confirmation.
-- Le paiement ne réactive jamais en bloc les profils ou pharmacies ; les suspensions/résiliations indépendantes restent intactes.
create or replace function public.admin_confirmer_reglement_promoteur(p_reglement uuid,p_admin uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.abonnement_promoteur_reglements%rowtype;
  a public.abonnements_promoteurs%rowtype;
  c public.conventions_promoteurs%rowtype;
  v_debut date;
  v_fin date;
  v_payment_id text;
  v_recu text;
begin
  if not exists (
    select 1 from public.profiles
    where id=p_admin and role::text='admin' and actif=true
  ) then
    raise exception 'Accès administrateur actif requis';
  end if;

  select * into r
  from public.abonnement_promoteur_reglements
  where id=p_reglement
  for update;
  if not found then raise exception 'Règlement introuvable'; end if;

  if r.statut='confirme' then
    return jsonb_build_object(
      'id',r.id,'identifiant_paiement',r.identifiant_paiement,
      'numero_recu',r.numero_recu,'periode_du',r.periode_du,
      'periode_au',r.periode_au,'deja_confirme',true
    );
  end if;
  if r.statut<>'en_attente' then
    raise exception 'Ce règlement n’est plus en attente';
  end if;
  if r.paye_le is null or nullif(trim(coalesce(r.compte_payeur,'')),'') is null then
    raise exception 'Les références du paiement sont incomplètes';
  end if;
  if nullif(trim(coalesce(r.preuve_path,'')),'') is null then
    raise exception 'La preuve du paiement est obligatoire';
  end if;

  select * into a
  from public.abonnements_promoteurs
  where id=r.abonnement_id and promoteur_id=r.promoteur_id
  for update;
  if not found then raise exception 'Abonnement incohérent'; end if;

  select * into c
  from public.conventions_promoteurs
  where id=a.convention_id and promoteur_id=r.promoteur_id
  for update;
  if not found then raise exception 'Convention incohérente'; end if;

  if r.montant<>c.montant_mensuel or a.montant_mensuel<>c.montant_mensuel then
    raise exception 'Le montant enregistré ne correspond pas au tarif conventionné';
  end if;

  -- Une résiliation indépendante n'est jamais annulée par la confirmation d'un paiement.
  if a.statut='resilie' or c.statut='resiliee' then
    raise exception 'Abonnement ou convention résilié : examen administratif distinct requis';
  end if;

  v_debut := (now() at time zone 'Africa/Douala')::date;
  v_fin := (v_debut + interval '1 month' - interval '1 day')::date;
  v_payment_id := 'NAXA-PAY-'||to_char(v_debut,'YYYYMMDD')||'-'||upper(substr(replace(r.id::text,'-',''),1,10));
  v_recu := 'NAXA-REC-'||to_char(v_debut,'YYYYMMDD')||'-'||upper(substr(replace(r.id::text,'-',''),1,10));

  update public.abonnement_promoteur_reglements
  set statut='confirme', confirme_par=p_admin, confirme_le=now(),
      periode_du=v_debut, periode_au=v_fin,
      identifiant_paiement=v_payment_id, numero_recu=v_recu, updated_at=now()
  where id=r.id;

  update public.abonnements_promoteurs
  set debut=v_debut, echeance=v_fin, statut='actif',
      bloque_le=null, reactive_le=now(), reactive_par=p_admin,
      rappel_5j_envoye_at=null, rappel_5j_en_cours_at=null
  where id=a.id;

  update public.conventions_promoteurs
  set date_paiement=(r.paye_le at time zone 'Africa/Douala')::date,
      date_expiration=v_fin, statut='active', updated_at=now()
  where id=c.id;

  insert into public.abonnement_promoteur_paiements(
    abonnement_id,periode_du,periode_au,montant,reference,paye_le,enregistre_par
  ) values(a.id,v_debut,v_fin,r.montant,r.reference,r.paye_le,p_admin);

  -- Important : ne pas réactiver profiles, promoteur_pharmacies, pharmacies ni
  -- les profils enfants. Aucune colonne ne prouve que leur inactivation vient
  -- exclusivement de l'échéance; leur état doit donc être conservé.

  insert into public.notifications(user_id,type,titre,corps,fil_id)
  values(
    r.promoteur_id,'abonnement_reglement_confirme','Paiement confirmé · reçu disponible',
    'Votre paiement a été confirmé. Votre abonnement est renouvelé jusqu’au '||
    to_char(v_fin,'DD/MM/YYYY')||'. Identifiant de paiement : '||v_payment_id||
    '. Reçu : '||v_recu||'.',r.id
  );

  insert into public.journal_admin(admin_profile_id,action,cible_type,cible_id,motif,detail)
  values(
    p_admin,'reglement_promoteur_confirme','promoteur',r.promoteur_id::text,
    'Encaissement vérifié et abonnement renouvelé sans lever de suspension indépendante',
    jsonb_build_object(
      'reglement_id',r.id,'identifiant_paiement',v_payment_id,'numero_recu',v_recu,
      'montant',r.montant,'canal',r.canal,'compte_payeur',r.compte_payeur,
      'paye_le',r.paye_le,'periode_du',v_debut,'periode_au',v_fin,
      'profils_et_pharmacies_reactives',false
    )
  );

  return jsonb_build_object(
    'id',r.id,'identifiant_paiement',v_payment_id,'numero_recu',v_recu,
    'periode_du',v_debut,'periode_au',v_fin,'deja_confirme',false
  );
end;
$$;

revoke all on function public.admin_confirmer_reglement_promoteur(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_confirmer_reglement_promoteur(uuid,uuid) to service_role;
