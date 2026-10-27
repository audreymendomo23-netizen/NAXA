-- Corrige le flux de déclaration par le Promoteur et active les rappels à J-5.
-- Aucun paiement n'est créé par cette migration et aucun compte n'est réactivé.

create or replace function public.promoteur_soumettre_reglement(
  p_promoteur uuid,
  p_montant integer,
  p_canal text,
  p_canal_autre text,
  p_compte_payeur text,
  p_reference text,
  p_paye_le timestamptz,
  p_preuve_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_abonnement public.abonnements_promoteurs%rowtype;
  v_convention public.conventions_promoteurs%rowtype;
  v_id uuid;
  v_admin record;
  v_canal_label text;
  v_promoteur_label text;
begin
  if p_promoteur is null or not exists (
    select 1 from public.profiles where id = p_promoteur and role::text = 'promoteur'
  ) then
    raise exception 'Promoteur introuvable';
  end if;
  if p_montant is null or p_montant <= 0 then
    raise exception 'Montant invalide';
  end if;
  if p_canal not in ('orange_money','mtn_momo','virement','depot_bancaire','especes','autre') then
    raise exception 'Canal de paiement invalide';
  end if;
  if p_canal = 'autre' and length(trim(coalesce(p_canal_autre,''))) not between 2 and 80 then
    raise exception 'Précisez le canal de paiement';
  end if;
  if length(trim(coalesce(p_compte_payeur,''))) < 3 or length(trim(p_compte_payeur)) > 120 then
    raise exception 'Le numéro de compte ou de téléphone ayant effectué le paiement est requis';
  end if;
  if p_paye_le is null or p_paye_le > now() + interval '5 minutes' then
    raise exception 'La date réelle du paiement est requise et ne peut pas être future';
  end if;
  if p_preuve_path is null or p_preuve_path !~ (
    '^' || p_promoteur::text || '/[0-9a-fA-F-]+\.(pdf|jpg|jpeg|png|webp|mp4|webm|mov)$'
  ) then
    raise exception 'Chemin de preuve invalide';
  end if;

  select * into v_abonnement
  from public.abonnements_promoteurs
  where promoteur_id = p_promoteur
  for update;
  if not found then raise exception 'Abonnement Promoteur introuvable'; end if;

  select * into v_convention
  from public.conventions_promoteurs
  where id = v_abonnement.convention_id and promoteur_id = p_promoteur
  for update;
  if not found then raise exception 'Convention Promoteur introuvable'; end if;

  if p_montant <> v_abonnement.montant_mensuel or p_montant <> v_convention.montant_mensuel then
    raise exception 'Le montant ne correspond pas au tarif mensuel convenu';
  end if;
  if exists (
    select 1 from public.abonnement_promoteur_reglements
    where promoteur_id = p_promoteur and statut = 'en_attente'
  ) then
    raise exception 'Un règlement est déjà en attente pour ce Promoteur';
  end if;

  select coalesce(
    nullif(trim(concat_ws(' ', first_name, last_name)), ''),
    nullif(username, ''),
    p_promoteur::text
  )
  into v_promoteur_label
  from public.profiles where id = p_promoteur;

  insert into public.abonnement_promoteur_reglements (
    promoteur_id, abonnement_id, montant, canal, canal_autre, compte_payeur,
    reference, paye_le, preuve_path, enregistre_par
  )
  values (
    p_promoteur, v_abonnement.id, p_montant, p_canal,
    nullif(trim(coalesce(p_canal_autre,'')), ''),
    trim(p_compte_payeur), nullif(trim(coalesce(p_reference,'')), ''),
    p_paye_le, p_preuve_path, p_promoteur
  )
  returning id into v_id;

  v_canal_label := case p_canal
    when 'orange_money' then 'Orange Money'
    when 'mtn_momo' then 'MTN Mobile Money'
    when 'virement' then 'Virement bancaire'
    when 'depot_bancaire' then 'Dépôt bancaire'
    when 'especes' then 'Espèces'
    else coalesce(nullif(trim(p_canal_autre),''), 'Autre')
  end;

  for v_admin in
    select id from public.profiles where role::text = 'admin' and actif = true
  loop
    insert into public.notifications(user_id, type, titre, corps)
    values (
      v_admin.id,
      'abonnement_reglement_a_verifier',
      'Paiement Promoteur à vérifier',
      left(
        v_promoteur_label || ' a déclaré ' || p_montant::text || ' FCFA via ' || v_canal_label ||
        '. Compte payeur : ' || trim(p_compte_payeur) ||
        '. Référence : ' || coalesce(nullif(trim(p_reference),''), 'non renseignée') ||
        '. Date déclarée : ' || to_char(p_paye_le at time zone 'Africa/Douala','DD/MM/YYYY HH24:MI') ||
        '. Vérifiez la preuve et l’encaissement réel avant toute validation.',
        1000
      )
    );
  end loop;

  insert into public.notifications(user_id, type, titre, corps)
  values (
    p_promoteur,
    'abonnement_reglement_soumis',
    'Paiement transmis à NAXA',
    'Votre déclaration de paiement a été transmise à l’administrateur. Votre abonnement ne sera renouvelé qu’après vérification de l’encaissement réel.'
  );

  return v_id;
end;
$function$;

revoke all on function public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text) to service_role;

-- L'ancien parcours qui permettait à l'administrateur d'enregistrer lui-même
-- une déclaration est neutralisé : le paiement doit être déclaré par le Promoteur.
revoke all on function public.admin_enregistrer_reglement_promoteur(uuid,integer,text,text,text,timestamptz,text,uuid) from public, anon, authenticated, service_role;

create or replace function public.generer_rappels_echeance_promoteurs()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r record;
  v_admin record;
  v_due date := (now() at time zone 'Africa/Douala')::date + 5;
  v_count integer := 0;
begin
  for r in
    select a.id, a.promoteur_id, a.echeance, a.montant_mensuel,
           coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
                    nullif(p.username, ''), p.id::text) as nom_promoteur
    from public.abonnements_promoteurs a
    join public.profiles p on p.id = a.promoteur_id and p.role::text = 'promoteur'
    where a.statut = 'actif'
      and a.echeance = v_due
      and a.rappel_5j_envoye_at is null
    for update of a skip locked
  loop
    insert into public.notifications(user_id, type, titre, corps)
    values (
      r.promoteur_id,
      'abonnement_echeance_5j',
      'Votre abonnement expire dans 5 jours',
      'Votre abonnement mensuel NAXA arrive à échéance le ' ||
      to_char(r.echeance, 'DD/MM/YYYY') || '. Tarif mensuel : ' ||
      r.montant_mensuel::text || ' FCFA. Effectuez le paiement par votre canal habituel, puis déclarez-le dans « Mes paiements » avec ses références et sa preuve.'
    );

    for v_admin in
      select id from public.profiles where role::text = 'admin' and actif = true
    loop
      insert into public.notifications(user_id, type, titre, corps)
      values (
        v_admin.id,
        'abonnement_echeance_5j_admin',
        'Échéance Promoteur dans 5 jours',
        left(
          'L’abonnement de ' || r.nom_promoteur || ' arrive à échéance le ' ||
          to_char(r.echeance, 'DD/MM/YYYY') || '. Tarif mensuel : ' ||
          r.montant_mensuel::text || ' FCFA. Suivez le règlement et sa validation dans le pilotage NAXA.',
          1000
        )
      );
    end loop;

    update public.abonnements_promoteurs
    set rappel_5j_envoye_at = now(), rappel_5j_en_cours_at = null
    where id = r.id and rappel_5j_envoye_at is null;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.generer_rappels_echeance_promoteurs() from public, anon, authenticated;
grant execute on function public.generer_rappels_echeance_promoteurs() to service_role;

do $schedule$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'naxa-promoteur-echeance-5j'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
  perform cron.schedule(
    'naxa-promoteur-echeance-5j',
    '0 6 * * *',
    'select public.generer_rappels_echeance_promoteurs();'
  );
end;
$schedule$;
