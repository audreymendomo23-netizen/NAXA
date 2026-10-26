alter table public.abonnement_promoteur_reglements
  add column if not exists compte_payeur text,
  add column if not exists identifiant_paiement text;

update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']
where id = 'preuves-reglements-promoteurs';

create or replace function public.promoteur_soumettre_reglement(
  p_promoteur uuid,
  p_montant integer,
  p_canal text,
  p_canal_autre text,
  p_compte_payeur text,
  p_reference text,
  p_paye_le timestamptz,
  p_preuve_path text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_abonnement public.abonnements_promoteurs%rowtype;
  v_convention public.conventions_promoteurs%rowtype;
  v_id uuid;
  v_admin record;
  v_canal_label text;
begin
  if p_promoteur is null or not exists (
    select 1 from public.profiles where id=p_promoteur and role::text='promoteur'
  ) then raise exception 'Promoteur introuvable'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Montant invalide'; end if;
  if p_canal not in ('orange_money','mtn_momo','virement','depot_bancaire','especes','autre') then
    raise exception 'Canal de paiement invalide';
  end if;
  if p_canal='autre' and length(trim(coalesce(p_canal_autre,''))) not between 2 and 80 then
    raise exception 'Précisez le canal de paiement';
  end if;
  if length(trim(coalesce(p_compte_payeur,''))) < 3 or length(trim(p_compte_payeur)) > 120 then
    raise exception 'Le numéro de compte ou de téléphone ayant effectué le paiement est requis';
  end if;
  if p_paye_le is null or p_paye_le > now() + interval '5 minutes' then
    raise exception 'La date réelle du paiement est requise et ne peut pas être future';
  end if;
  if p_preuve_path is null or p_preuve_path !~ ('^' || p_promoteur::text || '/[0-9a-fA-F-]+\.(pdf|jpg|jpeg|png|webp|mp4|webm|mov)$') then
    raise exception 'Chemin de preuve invalide';
  end if;

  select * into v_abonnement from public.abonnements_promoteurs
   where promoteur_id=p_promoteur for update;
  if not found then raise exception 'Abonnement Promoteur introuvable'; end if;
  select * into v_convention from public.conventions_promoteurs
   where id=v_abonnement.convention_id and promoteur_id=p_promoteur for update;
  if not found then raise exception 'Convention Promoteur introuvable'; end if;
  if p_montant <> v_abonnement.montant_mensuel or p_montant <> v_convention.montant_mensuel then
    raise exception 'Le montant ne correspond pas au tarif mensuel convenu';
  end if;
  if exists(select 1 from public.abonnement_promoteur_reglements where promoteur_id=p_promoteur and statut='en_attente') then
    raise exception 'Un règlement est déjà en attente pour ce Promoteur';
  end if;

  insert into public.abonnement_promoteur_reglements(
    promoteur_id,abonnement_id,montant,canal,canal_autre,compte_payeur,reference,paye_le,preuve_path,enregistre_par
  ) values (
    p_promoteur,v_abonnement.id,p_montant,p_canal,nullif(trim(coalesce(p_canal_autre,'')),''),
    trim(p_compte_payeur),nullif(trim(coalesce(p_reference,'')),''),p_paye_le,p_preuve_path,p_promoteur
  ) returning id into v_id;

  v_canal_label := case p_canal
    when 'orange_money' then 'Orange Money'
    when 'mtn_momo' then 'MTN Mobile Money'
    when 'virement' then 'Virement bancaire'
    when 'depot_bancaire' then 'Dépôt bancaire'
    when 'especes' then 'Espèces'
    else coalesce(nullif(trim(p_canal_autre),''),'Autre') end;

  for v_admin in select id from public.profiles where role::text='admin' and actif=true loop
    insert into public.notifications(user_id,type,titre,corps)
    values(v_admin.id,'abonnement_reglement_a_verifier','Paiement Promoteur à vérifier',
      'Un paiement de '||p_montant::text||' FCFA a été soumis via '||v_canal_label||
      '. Compte payeur : '||trim(p_compte_payeur)||'. Référence : '||coalesce(nullif(trim(p_reference),''),'non renseignée')||
      '. Date déclarée : '||to_char(p_paye_le at time zone 'Africa/Douala','DD/MM/YYYY HH24:MI')||
      '. Ouvrez le suivi des règlements pour vérifier la preuve.');
  end loop;
  insert into public.notifications(user_id,type,titre,corps)
  values(p_promoteur,'abonnement_reglement_soumis','Paiement transmis à NAXA',
    'Votre déclaration de paiement a été transmise à l’administrateur pour vérification. Votre abonnement ne sera renouvelé qu’après confirmation.');
  return v_id;
end $$;

revoke all on function public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text) to service_role;

create or replace function public.admin_confirmer_reglement_promoteur(p_reglement uuid,p_admin uuid)
returns jsonb language plpgsql security definer set search_path = ''
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
  if not exists(select 1 from public.profiles where id=p_admin and role::text='admin' and actif=true) then
    raise exception 'Accès administrateur actif requis';
  end if;
  select * into r from public.abonnement_promoteur_reglements where id=p_reglement for update;
  if not found then raise exception 'Règlement introuvable'; end if;
  if r.statut='confirme' then
    return jsonb_build_object('id',r.id,'identifiant_paiement',r.identifiant_paiement,'numero_recu',r.numero_recu,'periode_du',r.periode_du,'periode_au',r.periode_au,'deja_confirme',true);
  end if;
  if r.statut <> 'en_attente' then raise exception 'Ce règlement n’est plus en attente'; end if;
  select * into a from public.abonnements_promoteurs where id=r.abonnement_id and promoteur_id=r.promoteur_id for update;
  if not found then raise exception 'Abonnement incohérent'; end if;
  select * into c from public.conventions_promoteurs where id=a.convention_id and promoteur_id=r.promoteur_id for update;
  if not found then raise exception 'Convention incohérente'; end if;
  if r.montant <> c.montant_mensuel or a.montant_mensuel <> c.montant_mensuel then
    raise exception 'Le montant enregistré ne correspond pas au tarif conventionné';
  end if;
  if r.paye_le is null or nullif(trim(coalesce(r.compte_payeur,'')),'') is null then
    raise exception 'Les références du paiement sont incomplètes';
  end if;

  v_debut := (now() at time zone 'Africa/Douala')::date;
  v_fin := v_debut + 31;
  v_payment_id := 'NAXA-PAY-'||to_char(v_debut,'YYYYMMDD')||'-'||upper(substr(replace(r.id::text,'-',''),1,10));
  v_recu := 'NAXA-REC-'||to_char(v_debut,'YYYYMMDD')||'-'||upper(substr(replace(r.id::text,'-',''),1,10));

  update public.abonnement_promoteur_reglements
   set statut='confirme',confirme_par=p_admin,confirme_le=now(),
       periode_du=v_debut,periode_au=v_fin,identifiant_paiement=v_payment_id,numero_recu=v_recu,updated_at=now()
   where id=r.id;

  update public.abonnements_promoteurs
   set debut=v_debut,echeance=v_fin,statut='actif',bloque_le=null,reactive_le=now(),reactive_par=p_admin,
       rappel_5j_envoye_at=null,rappel_5j_en_cours_at=null
   where id=a.id;
  update public.conventions_promoteurs
   set date_paiement=(r.paye_le at time zone 'Africa/Douala')::date,
       date_expiration=v_fin,statut='active',updated_at=now()
   where id=c.id;

  insert into public.abonnement_promoteur_paiements(abonnement_id,periode_du,periode_au,montant,reference,paye_le,enregistre_par)
  values(a.id,v_debut,v_fin,r.montant,r.reference,r.paye_le,p_admin);

  update public.profiles set actif=true where id=r.promoteur_id;
  update public.promoteur_pharmacies set actif=true where promoteur_id=r.promoteur_id;
  update public.pharmacies ph set actif=true
   where exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=r.promoteur_id and pp.pharmacie_id=ph.id);
  update public.profiles pr set actif=true
   where exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=r.promoteur_id and pp.pharmacie_id=pr.pharmacie_id);

  insert into public.notifications(user_id,type,titre,corps)
  values(r.promoteur_id,'abonnement_reglement_confirme','Paiement confirmé · reçu disponible',
    'Votre paiement a été confirmé. Votre abonnement est renouvelé jusqu’au '||to_char(v_fin,'DD/MM/YYYY')||
    '. Identifiant de paiement : '||v_payment_id||'. Reçu : '||v_recu||'.');
  insert into public.journal_admin(admin_profile_id,action,cible_type,cible_id,motif,detail)
  values(p_admin,'reglement_promoteur_confirme','promoteur',r.promoteur_id::text,
    'Encaissement vérifié et abonnement renouvelé pour 31 jours à compter de la validation',
    jsonb_build_object('reglement_id',r.id,'identifiant_paiement',v_payment_id,'numero_recu',v_recu,
      'montant',r.montant,'canal',r.canal,'compte_payeur',r.compte_payeur,'paye_le',r.paye_le,
      'periode_du',v_debut,'periode_au',v_fin));
  return jsonb_build_object('id',r.id,'identifiant_paiement',v_payment_id,'numero_recu',v_recu,'periode_du',v_debut,'periode_au',v_fin,'deja_confirme',false);
end $$;
revoke all on function public.admin_confirmer_reglement_promoteur(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_confirmer_reglement_promoteur(uuid,uuid) to service_role;
