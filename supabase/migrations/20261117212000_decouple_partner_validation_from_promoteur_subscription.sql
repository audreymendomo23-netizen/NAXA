begin;

-- La validation du dossier partenaire ne dépend plus de l'abonnement Promoteur.
create or replace function public.admin_valider_dossier_partenaire(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_universe text;
  v_owner uuid;
  v_type text;
  v_expected text;
  v_role text;
  v_enabled boolean;
  v_rows integer;
  v_current boolean;
  v_disciplined boolean;
  v_partner_status text;
  v_today date:=(now() at time zone 'Africa/Douala')::date;
begin
  if not public.is_admin() then raise exception 'Accès administrateur requis' using errcode='42501'; end if;
  select d.universe_slug,d.promoteur_id,p.partner_type
  into v_universe,v_owner,v_type
  from public.admin_partner_dossiers d
  join public.partners p on p.id=d.partner_id
  where d.partner_id=p_partner_id and d.dossier_status='pending' and p.status='pending'
  for update of d,p;
  if not found then raise exception 'Dossier partenaire introuvable ou déjà traité' using errcode='P0002'; end if;

  v_expected:=case v_universe
    when 'parapharmacie' then 'parapharmacie'
    when 'examens' then 'centre_examen'
    when 'prestations' then 'professionnel_domicile'
    when 'aide' then 'autre'
    else null end;
  if v_expected is null or v_type is distinct from v_expected then
    raise exception 'Type de partenaire incohérent' using errcode='23514';
  end if;
  if v_universe<>'aide' and not exists(
    select 1 from public.universes u join public.feature_flags f on f.flag_key='universe.'||u.slug
    where u.slug=v_universe and u.enabled and f.enabled
  ) then raise exception 'Univers inactif' using errcode='23514'; end if;

  select pm.member_role into v_role from public.partner_members pm
  where pm.partner_id=p_partner_id and pm.user_id=v_owner for update;
  if not found or v_role<>'owner' then raise exception 'Titulaire non rattaché' using errcode='23514'; end if;

  select pu.enabled into v_enabled from public.partner_universes pu
  where pu.partner_id=p_partner_id and pu.universe_slug=v_universe for update;
  if not found or v_enabled then raise exception 'Association absente ou déjà active' using errcode='23514'; end if;

  update public.admin_partner_dossiers set dossier_status='validated',updated_at=now()
  where partner_id=p_partner_id and dossier_status='pending';
  if not found then raise exception 'Dossier déjà traité' using errcode='P0001'; end if;

  select exists(
    select 1 from public.partner_subscriptions s
    where s.partner_id=p_partner_id and (
      (s.status='active' and s.first_confirmed_payment_at is not null and s.due_date>=v_today)
      or (s.first_confirmed_payment_at is null and s.legacy_access_until>=v_today)
    )
  ) into v_current;
  v_disciplined:=private.naxa_owner_has_active_disciplinary_suspension(v_owner);
  v_partner_status:=case
    when v_disciplined then 'suspended'
    when v_current then 'active'
    else 'pending'
  end;

  update public.partners set status=v_partner_status,verified_at=now(),
    verified_by=v_actor,updated_at=now()
  where id=p_partner_id;
  update public.partner_universes set enabled=(v_partner_status='active')
  where partner_id=p_partner_id and universe_slug=v_universe;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Association non mise à jour' using errcode='23514'; end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'partner.dossier_validated','admin_partner_dossier',p_partner_id::text,
    jsonb_build_object('universe_slug',v_universe,'status',v_partner_status,
      'structure_subscription_current',v_current,'billing_mode','independent_per_structure',
      'promoteur_subscription_used',false,'identity_actif_mutated',false));
end;
$fn$;

-- Le paiement Promoteur ne réactive plus les structures indépendantes qu'il possède.
create or replace function public.admin_confirmer_reglement_promoteur(p_reglement uuid,p_admin uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  r public.abonnement_promoteur_reglements%rowtype;
  a public.abonnements_promoteurs%rowtype;
  c public.conventions_promoteurs%rowtype;
  v_debut date;
  v_fin date;
  v_payment_id text;
  v_recu text;
begin
  if not exists(
    select 1 from public.profiles
    where id=p_admin and role::text='admin' and actif=true
  ) then raise exception 'Accès administrateur actif requis'; end if;

  select * into r from public.abonnement_promoteur_reglements
  where id=p_reglement for update;
  if not found then raise exception 'Règlement introuvable'; end if;
  if r.statut='confirme' then
    return jsonb_build_object(
      'id',r.id,'identifiant_paiement',r.identifiant_paiement,
      'numero_recu',r.numero_recu,'periode_du',r.periode_du,
      'periode_au',r.periode_au,'deja_confirme',true
    );
  end if;
  if r.statut<>'en_attente' then raise exception 'Ce règlement n’est plus en attente'; end if;
  if r.paye_le is null or nullif(trim(coalesce(r.compte_payeur,'')),'') is null then
    raise exception 'Les références du paiement sont incomplètes';
  end if;

  select * into a from public.abonnements_promoteurs
  where id=r.abonnement_id and promoteur_id=r.promoteur_id for update;
  if not found then raise exception 'Abonnement incohérent'; end if;
  select * into c from public.conventions_promoteurs
  where id=a.convention_id and promoteur_id=r.promoteur_id for update;
  if not found then raise exception 'Convention incohérente'; end if;
  if r.montant<>c.montant_mensuel or a.montant_mensuel<>c.montant_mensuel then
    raise exception 'Le montant enregistré ne correspond pas au tarif conventionné';
  end if;
  if a.statut='resilie' or c.statut='resiliee' then
    raise exception 'Abonnement ou convention résilié : examen administratif distinct requis';
  end if;

  v_debut:=(now() at time zone 'Africa/Douala')::date;
  v_fin:=(v_debut+interval '1 month'-interval '1 day')::date;
  v_payment_id:='NAXA-PAY-'||to_char(v_debut,'YYYYMMDD')||'-'||upper(substr(replace(r.id::text,'-',''),1,10));
  v_recu:='NAXA-REC-'||to_char(v_debut,'YYYYMMDD')||'-'||upper(substr(replace(r.id::text,'-',''),1,10));

  update public.abonnement_promoteur_reglements
  set statut='confirme',confirme_par=p_admin,confirme_le=now(),
      periode_du=v_debut,periode_au=v_fin,
      identifiant_paiement=v_payment_id,numero_recu=v_recu,updated_at=now()
  where id=r.id;

  update public.abonnements_promoteurs
  set debut=v_debut,echeance=v_fin,statut='actif',
      bloque_le=null,reactive_le=now(),reactive_par=p_admin,
      rappel_5j_envoye_at=null,rappel_5j_en_cours_at=null
  where id=a.id;

  update public.conventions_promoteurs
  set date_paiement=(r.paye_le at time zone 'Africa/Douala')::date,
      date_expiration=v_fin,statut='active',updated_at=now()
  where id=c.id;

  insert into public.abonnement_promoteur_paiements(
    abonnement_id,periode_du,periode_au,montant,reference,paye_le,enregistre_par
  ) values(a.id,v_debut,v_fin,r.montant,r.reference,r.paye_le,p_admin);

  -- Seul le verrou du périmètre Promoteur/Pharmacie est levé.
  -- Aucun partenaire indépendant n'est réactivé par ce règlement.
  if exists(select 1 from public.naxa_subscription_access_locks l
      where l.promoteur_id=r.promoteur_id and l.is_active=true)
    and not private.naxa_owner_has_active_disciplinary_suspension(r.promoteur_id) then
    update public.naxa_subscription_access_locks
    set is_active=false,released_at=now(),updated_at=now()
    where promoteur_id=r.promoteur_id and is_active=true;
  end if;

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
    'Encaissement vérifié et abonnement Promoteur renouvelé sans lever de suspension indépendante',
    jsonb_build_object(
      'reglement_id',r.id,'identifiant_paiement',v_payment_id,'numero_recu',v_recu,
      'montant',r.montant,'canal',r.canal,'compte_payeur',r.compte_payeur,
      'paye_le',r.paye_le,'periode_du',v_debut,'periode_au',v_fin,
      'structures_partenaires_reactivees',false
    )
  );

  return jsonb_build_object(
    'id',r.id,'identifiant_paiement',v_payment_id,'numero_recu',v_recu,
    'periode_du',v_debut,'periode_au',v_fin,'deja_confirme',false
  );
end;
$fn$;

-- Les verrous Promoteur ne sont créés qu'à partir de son propre abonnement impayé,
-- jamais parce qu'il détient un dossier d'un autre univers.
create or replace function public.synchroniser_validite_pharmacies()
returns integer
language plpgsql
security definer
set search_path=''
as $fn$
declare
  n integer:=0;
  v_today date:=(now() at time zone 'Africa/Douala')::date;
begin
  update public.abonnements_promoteurs ap
  set statut='impaye',bloque_le=coalesce(ap.bloque_le,now())
  where ap.echeance<v_today and ap.statut='actif'
    and not exists(
      select 1 from public.abonnement_promoteur_reglements r
      where r.abonnement_id=ap.id and r.promoteur_id=ap.promoteur_id
        and r.statut='en_attente' and r.montant=ap.montant_mensuel
        and r.canal in ('orange_money','mtn_momo') and r.reference_normalisee is not null
        and r.verification_deadline_at>now()
    );

  update public.conventions_promoteurs c
  set statut='expiree',updated_at=now()
  where c.date_expiration<v_today and c.statut='active'
    and not exists(
      select 1 from public.abonnements_promoteurs ap
      join public.abonnement_promoteur_reglements r
        on r.abonnement_id=ap.id and r.promoteur_id=ap.promoteur_id
      where ap.convention_id=c.id and ap.promoteur_id=c.promoteur_id
        and r.statut='en_attente' and r.montant=ap.montant_mensuel
        and r.canal in ('orange_money','mtn_momo') and r.reference_normalisee is not null
        and r.verification_deadline_at>now()
    );

  update public.pharmacies ph
  set actif=false
  where ph.actif=true and exists(
    select 1 from public.abonnements_promoteurs ap
    join public.promoteur_pharmacies pp on pp.promoteur_id=ap.promoteur_id
    where pp.pharmacie_id=ph.id and ap.statut='impaye'
  );
  get diagnostics n=row_count;

  insert into public.naxa_subscription_access_locks(
    promoteur_id,is_active,lock_reason,locked_at,released_at
  )
  select distinct ap.promoteur_id,true,'expired_unpaid',now(),null::timestamptz
  from public.abonnements_promoteurs ap
  join public.profiles pr on pr.id=ap.promoteur_id and pr.actif=true and pr.role::text='promoteur'
  where ap.statut='impaye'
  on conflict(promoteur_id) do update
    set is_active=true,lock_reason='expired_unpaid',locked_at=now(),
        released_at=null,updated_at=now();

  return n;
end;
$fn$;

commit;
