begin;

-- OrangeMoney n'inclut pas toujours l'heure operateur dans le corps SMS.
alter table public.naxa_promoteur_payment_capture_events alter column provider_occurred_at drop not null;

-- Les paiements bancaires restent consultables dans l'historique, mais ne sont plus
-- proposés comme destination et ne peuvent plus être déclarés pour un abonnement.
alter table public.naxa_payment_destinations
  drop constraint if exists naxa_payment_destinations_canal_check;
alter table public.naxa_payment_destinations
  add constraint naxa_payment_destinations_canal_check
  check (canal in ('orange_money','mtn_momo'));
delete from public.naxa_payment_destinations
where canal not in ('orange_money','mtn_momo');

-- Champs de suivi de la vérification sans conserver le SMS brut ni les noms personnels.
alter table public.abonnement_promoteur_reglements
  add column if not exists reference_normalisee text
    generated always as (nullif(upper(regexp_replace(coalesce(reference,''), '[^A-Za-z0-9]', '', 'g')), '')) stored,
  add column if not exists verification_deadline_at timestamptz,
  add column if not exists verification_level smallint not null default 0,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verification_details jsonb not null default '{}'::jsonb;

update public.abonnement_promoteur_reglements
set verification_deadline_at = coalesce(declared_at,created_at) + interval '24 hours',
    verification_status = case
      when statut = 'confirme' then 'coherent_needs_operator_confirmation'
      when statut = 'conteste' then 'invalid'
      else 'pending'
    end
where verification_deadline_at is null;

alter table public.abonnement_promoteur_reglements
  alter column verification_deadline_at set not null,
  alter column verification_deadline_at set default (now() + interval '24 hours');

alter table public.abonnement_promoteur_reglements
  drop constraint if exists abonnement_promoteur_reglements_verification_level_ck,
  drop constraint if exists abonnement_promoteur_reglements_verification_status_ck,
  drop constraint if exists abonnement_promoteur_reglements_verification_details_object_ck;

alter table public.abonnement_promoteur_reglements
  add constraint abonnement_promoteur_reglements_verification_level_ck
    check (verification_level between 0 and 3),
  add constraint abonnement_promoteur_reglements_verification_status_ck
    check (verification_status in ('pending','coherent_needs_operator_confirmation','manual_review','invalid','confirmed_admin')),
  add constraint abonnement_promoteur_reglements_verification_details_object_ck
    check (jsonb_typeof(verification_details) = 'object');

do $duplicates$
begin
  if exists (
    select 1 from public.abonnement_promoteur_reglements
    where reference_normalisee is not null
    group by reference_normalisee having count(*) > 1
  ) then
    raise exception 'Migration refusee : des references de paiement normalisees sont deja dupliquees.';
  end if;
end;
$duplicates$;

create unique index if not exists abonnement_promoteur_reglements_reference_unique
  on public.abonnement_promoteur_reglements(reference_normalisee)
  where reference_normalisee is not null;

alter table public.naxa_promoteur_payment_capture_events
  add column if not exists transaction_reference_normalisee text generated always as
    (nullif(upper(regexp_replace(coalesce(transaction_reference,''), '[^A-Za-z0-9]', '', 'g')), '')) stored;
create unique index if not exists naxa_promoteur_payment_capture_events_reference_unique
  on public.naxa_promoteur_payment_capture_events(transaction_reference_normalisee)
  where transaction_reference_normalisee is not null;

create index if not exists abonnement_promoteur_reglements_verification_deadline_idx
  on public.abonnement_promoteur_reglements(verification_deadline_at)
  where statut = 'en_attente';

-- Registre global de toutes les references, y compris les references secondaires
-- du marchand (ex. MP) distinctes de la reference de debit du payeur (ex. PP).
create table if not exists public.naxa_promoteur_payment_reference_claims (
  id uuid primary key default gen_random_uuid(),
  reglement_id uuid not null references public.abonnement_promoteur_reglements(id) on delete restrict,
  canal text not null check (canal in ('orange_money','mtn_momo')),
  transaction_reference text not null check (length(trim(transaction_reference)) between 3 and 160),
  reference_normalisee text generated always as
    (nullif(upper(regexp_replace(coalesce(transaction_reference,''), '[^A-Za-z0-9]', '', 'g')), '')) stored,
  source_level smallint not null check (source_level between 1 and 3),
  source_type text not null check (source_type in ('payer_sms','merchant_sms','promoter_submission')),
  provider_occurred_at timestamptz,
  sms_received_at timestamptz,
  payload_sha256 text check (payload_sha256 is null or payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint naxa_promoteur_payment_reference_nonempty_ck
    check (reference_normalisee is not null and length(reference_normalisee) >= 5)
);

create unique index if not exists naxa_promoteur_payment_reference_claims_unique
  on public.naxa_promoteur_payment_reference_claims(reference_normalisee);
create index if not exists naxa_promoteur_payment_reference_claims_reglement_idx
  on public.naxa_promoteur_payment_reference_claims(reglement_id,created_at);

alter table public.naxa_promoteur_payment_reference_claims enable row level security;
revoke all on public.naxa_promoteur_payment_reference_claims from public,anon,authenticated;
grant all on public.naxa_promoteur_payment_reference_claims to service_role;

insert into public.naxa_promoteur_payment_reference_claims(
  reglement_id,canal,transaction_reference,source_level,source_type,provider_occurred_at,created_at
)
select r.id,r.canal,r.reference,3,'promoter_submission',r.paye_le,coalesce(r.declared_at,r.created_at)
from public.abonnement_promoteur_reglements r
where r.reference_normalisee is not null
  and r.canal in ('orange_money','mtn_momo')
on conflict do nothing;

create or replace function public.naxa_promoteur_payment_add_reference(
  p_reglement uuid,
  p_canal text,
  p_reference text,
  p_source_level smallint,
  p_source_type text,
  p_provider_occurred_at timestamptz default null,
  p_sms_received_at timestamptz default null,
  p_payload_sha256 text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r public.abonnement_promoteur_reglements%rowtype;
  v_id uuid;
  v_reference text := upper(regexp_replace(trim(coalesce(p_reference,'')), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service interne NAXA requis';
  end if;
  if p_reglement is null or p_canal not in ('orange_money','mtn_momo')
     or p_source_level not in (1,2,3)
     or p_source_type not in ('payer_sms','merchant_sms','promoter_submission')
     or length(v_reference) < 5 or length(v_reference) > 160 then
    raise exception 'Reference ou source de paiement invalide';
  end if;
  select * into r from public.abonnement_promoteur_reglements
  where id=p_reglement for update;
  if not found or r.statut <> 'en_attente' then
    raise exception 'Reglement absent ou deja traite';
  end if;
  if r.canal <> p_canal or r.verification_deadline_at <= now() then
    raise exception 'Canal incorrect ou delai de verification expire';
  end if;
  if p_provider_occurred_at is not null
     and (p_provider_occurred_at > now() + interval '5 minutes'
       or p_provider_occurred_at < r.paye_le - interval '15 minutes'
       or p_provider_occurred_at > r.paye_le + interval '30 minutes') then
    raise exception 'Horodatage operateur incoherent avec le paiement declare';
  end if;
  if p_sms_received_at is not null
     and (p_sms_received_at > now() + interval '5 minutes'
       or p_sms_received_at < r.declared_at - interval '5 minutes'
       or p_sms_received_at > r.verification_deadline_at) then
    raise exception 'Horodatage de reception SMS hors de la fenetre autorisee';
  end if;

  select id into v_id from public.naxa_promoteur_payment_reference_claims
  where reference_normalisee=v_reference and reglement_id=r.id;
  if v_id is not null then return v_id; end if;

  -- Empêche aussi une référence secondaire (ex. MP) de réutiliser la référence
  -- principale d'un ancien règlement conservé dans l'historique bancaire.
  if exists (
    select 1 from public.abonnement_promoteur_reglements existing
    where existing.reference_normalisee=v_reference and existing.id<>r.id
  ) then
    raise exception 'Cette reference de transaction existe deja dans l historique des reglements NAXA';
  end if;

  insert into public.naxa_promoteur_payment_reference_claims(
    reglement_id,canal,transaction_reference,source_level,source_type,
    provider_occurred_at,sms_received_at,payload_sha256
  ) values (
    r.id,p_canal,trim(p_reference),p_source_level,p_source_type,
    p_provider_occurred_at,p_sms_received_at,p_payload_sha256
  ) returning id into v_id;

  update public.abonnement_promoteur_reglements
  set verification_level=greatest(verification_level,p_source_level),
      verification_details=verification_details || jsonb_build_object(
        'secondary_reference_added',true,
        'secondary_reference_source',p_source_type,
        'secondary_reference_at',now()
      ),
      updated_at=now()
  where id=r.id;
  return v_id;
end;
$function$;

revoke all on function public.naxa_promoteur_payment_add_reference(uuid,text,text,smallint,text,timestamptz,timestamptz,text)
  from public,anon,authenticated;
grant execute on function public.naxa_promoteur_payment_add_reference(uuid,text,text,smallint,text,timestamptz,timestamptz,text)
  to service_role;

-- Nouvelle signature : uniquement Orange/MTN, référence obligatoire, montant exact,
-- date/heure du paiement dans les dernières 24 h, et tolérance contrôlée de 24 h.
drop function if exists public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text);
create function public.promoteur_soumettre_reglement(
  p_promoteur uuid,
  p_montant integer,
  p_canal text,
  p_canal_autre text,
  p_compte_payeur text,
  p_reference text,
  p_paye_le timestamptz,
  p_preuve_path text,
  p_verification_details jsonb default '{}'::jsonb
) returns uuid
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
  v_destination jsonb;
  v_declared_at timestamptz := clock_timestamp();
  v_details jsonb := case
    when jsonb_typeof(coalesce(p_verification_details,'{}'::jsonb))='object'
    then coalesce(p_verification_details,'{}'::jsonb) else '{}'::jsonb end;
  v_level smallint;
  v_analysis_status text;
begin
  if p_promoteur is null or not exists (
    select 1 from public.profiles where id=p_promoteur and role::text='promoteur'
  ) then raise exception 'Promoteur introuvable'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Montant invalide'; end if;
  if p_canal not in ('orange_money','mtn_momo') then
    raise exception 'Seuls Orange Money et MTN Mobile Money sont autorises pour un abonnement Promoteur';
  end if;
  if length(trim(coalesce(p_compte_payeur,''))) < 3 or length(trim(p_compte_payeur)) > 120 then
    raise exception 'Numero du payeur obligatoire';
  end if;
  if nullif(trim(coalesce(p_reference,'')),'') is null or length(trim(p_reference)) > 160 then
    raise exception 'Reference de transaction obligatoire';
  end if;
  if p_paye_le is null or p_paye_le > v_declared_at + interval '5 minutes'
     or p_paye_le < v_declared_at - interval '24 hours' then
    raise exception 'Date et heure reelles du paiement hors de la fenetre des dernieres 24 heures';
  end if;
  if p_preuve_path is not null and p_preuve_path !~ (
    '^' || p_promoteur::text || '/[0-9a-fA-F-]+\.(pdf|jpg|jpeg|png|webp)$'
  ) then raise exception 'Chemin de preuve invalide'; end if;

  select * into v_abonnement from public.abonnements_promoteurs
  where promoteur_id=p_promoteur for update;
  if not found then raise exception 'Abonnement Promoteur introuvable'; end if;
  select * into v_convention from public.conventions_promoteurs
  where id=v_abonnement.convention_id and promoteur_id=p_promoteur for update;
  if not found then raise exception 'Convention Promoteur introuvable'; end if;
  if p_montant <> v_abonnement.montant_mensuel or p_montant <> v_convention.montant_mensuel then
    raise exception 'Montant different du tarif mensuel conventionne';
  end if;
  if exists(select 1 from public.abonnement_promoteur_reglements
    where promoteur_id=p_promoteur and statut in ('en_attente','non_confirme')) then
    raise exception 'Un reglement est deja en attente pour ce Promoteur';
  end if;

  if exists (
    select 1 from public.naxa_promoteur_payment_reference_claims
    where reference_normalisee=upper(regexp_replace(trim(p_reference),'[^A-Za-z0-9]','','g'))
  ) then raise exception 'Cette reference de transaction a deja ete utilisee dans NAXA'; end if;

  select jsonb_build_object(
    'canal',d.canal,'beneficiaire',d.beneficiaire,
    'reference_destination',d.reference_destination,'instructions',d.instructions,'updated_at',d.updated_at
  ) into v_destination
  from public.naxa_payment_destinations d
  where d.canal=p_canal and d.actif=true for share;
  if v_destination is null then raise exception 'Destination de paiement non configuree ou inactive'; end if;

  select coalesce(nullif(trim(concat_ws(' ',first_name,last_name)),''),nullif(username,''),p_promoteur::text)
  into v_promoteur_label from public.profiles where id=p_promoteur;

  v_level := case when (v_details->>'level') in ('1','2','3') then (v_details->>'level')::smallint else 3 end;
  v_analysis_status := case
    when v_details->>'status' in ('coherent_needs_operator_confirmation','manual_review','invalid')
    then v_details->>'status' else 'manual_review' end;

  insert into public.abonnement_promoteur_reglements(
    promoteur_id,abonnement_id,montant,canal,canal_autre,compte_payeur,reference,
    paye_le,preuve_path,enregistre_par,destination_snapshot,destination_snapshot_at,
    declared_at,verification_deadline_at,verification_level,verification_status,verification_details
  ) values (
    p_promoteur,v_abonnement.id,p_montant,p_canal,null,trim(p_compte_payeur),trim(p_reference),
    p_paye_le,p_preuve_path,p_promoteur,v_destination,v_declared_at,v_declared_at,
    v_declared_at+interval '24 hours',v_level,v_analysis_status,v_details
  ) returning id into v_id;

  insert into public.naxa_promoteur_payment_reference_claims(
    reglement_id,canal,transaction_reference,source_level,source_type,provider_occurred_at,sms_received_at
  ) values (
    v_id,p_canal,trim(p_reference),v_level,
    case when v_level=1 then 'payer_sms' when v_level=2 then 'merchant_sms' else 'promoter_submission' end,
    nullif(v_details->>'providerOccurredAt','')::timestamptz,
    nullif(v_details->>'smsReceivedAt','')::timestamptz
  );

  v_canal_label := case p_canal when 'orange_money' then 'Orange Money' else 'MTN Mobile Money' end;
  for v_admin in select id from public.profiles where role::text='admin' and actif=true loop
    insert into public.notifications(user_id,type,titre,corps)
    values (
      v_admin.id,'abonnement_reglement_a_verifier','Paiement Promoteur a verifier',
      left(v_promoteur_label || ' a declare ' || p_montant::text || ' FCFA via ' || v_canal_label ||
        '. Compte payeur : ' || trim(p_compte_payeur) || '. Reference : ' || trim(p_reference) ||
        '. Paiement declare : ' || to_char(p_paye_le at time zone 'Africa/Douala','DD/MM/YYYY HH24:MI') ||
        '. Echeance de verification : ' || to_char((v_declared_at+interval '24 hours') at time zone 'Africa/Douala','DD/MM/YYYY HH24:MI') ||
        '. Analysez les elements et confirmez uniquement apres controle de l''encaissement.',1000)
    );
  end loop;
  insert into public.notifications(user_id,type,titre,corps)
  values (
    p_promoteur,'abonnement_reglement_soumis','Paiement transmis a NAXA',
    'Votre declaration est en cours de verification pendant 24 heures. Ce delai ne confirme pas le paiement et ne renouvelle pas encore votre abonnement.'
  );
  return v_id;
end;
$function$;

revoke all on function public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text,jsonb)
  to service_role;

-- Le controle commercial conserve tous les gardes d'identite, d'affectation,
-- d'architecture et d'etat des pharmacies. Seule une echeance est toleree 24 h.
create or replace function private.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    join public.conventions_promoteurs c on c.promoteur_id=p.id
    join public.abonnements_promoteurs a on a.promoteur_id=p.id and a.convention_id=c.id
    where p.id=p_promoteur
      and p.role::text='promoteur'
      and p.actif=true
      and c.statut='active'
      and (
        c.date_expiration>=current_date
        or exists (
          select 1 from public.abonnement_promoteur_reglements r
          where r.promoteur_id=p.id and r.abonnement_id=a.id and r.statut='en_attente'
            and r.montant=a.montant_mensuel and r.canal in ('orange_money','mtn_momo')
            and r.reference_normalisee is not null and r.verification_deadline_at>now()
        )
      )
      and c.architecture_code is not null
      and a.statut='actif'
      and (
        a.echeance>=current_date
        or exists (
          select 1 from public.abonnement_promoteur_reglements r
          where r.promoteur_id=p.id and r.abonnement_id=a.id and r.statut='en_attente'
            and r.montant=a.montant_mensuel and r.canal in ('orange_money','mtn_momo')
            and r.reference_normalisee is not null and r.verification_deadline_at>now()
        )
      )
      and exists (select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=p.id and pp.actif=true)
      and not exists (
        select 1 from public.promoteur_pharmacies pp
        left join public.pharmacies ph on ph.id=pp.pharmacie_id
        left join public.pharmacie_architectures pa
          on pa.pharmacie_id=pp.pharmacie_id and pa.active=true and pa.architecture_code=c.architecture_code
        where pp.promoteur_id=p.id and pp.actif=true
          and (ph.id is null or ph.actif is not true or pa.pharmacie_id is null)
      )
  );
$function$;
revoke all on function private.naxa_promoteur_valide(uuid) from public,anon,authenticated,service_role;

-- Le cron ignore seulement les abonnements en cours de verification. Aucune suspension
-- de profil/pharmacie n'est annulee ici ; le garde bloque a l'instant T+24 h.
create or replace function public.synchroniser_validite_pharmacies()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  n integer := 0;
begin
  update public.abonnements_promoteurs ap
  set statut='impaye',bloque_le=coalesce(ap.bloque_le,now())
  where ap.echeance<current_date and ap.statut='actif'
    and not exists (
      select 1 from public.abonnement_promoteur_reglements r
      where r.abonnement_id=ap.id and r.promoteur_id=ap.promoteur_id
        and r.statut='en_attente' and r.montant=ap.montant_mensuel
        and r.canal in ('orange_money','mtn_momo') and r.reference_normalisee is not null
        and r.verification_deadline_at>now()
    );

  update public.conventions_promoteurs c
  set statut='expiree',updated_at=now()
  where c.date_expiration<current_date and c.statut='active'
    and not exists (
      select 1 from public.abonnements_promoteurs ap
      join public.abonnement_promoteur_reglements r on r.abonnement_id=ap.id and r.promoteur_id=ap.promoteur_id
      where ap.convention_id=c.id and ap.promoteur_id=c.promoteur_id
        and r.statut='en_attente' and r.montant=ap.montant_mensuel
        and r.canal in ('orange_money','mtn_momo') and r.reference_normalisee is not null
        and r.verification_deadline_at>now()
    );

  update public.pharmacies ph
  set actif=false
  where ph.actif=true and exists (
    select 1 from public.abonnements_promoteurs ap
    join public.promoteur_pharmacies pp on pp.promoteur_id=ap.promoteur_id
    where pp.pharmacie_id=ph.id and ap.statut='impaye'
  );
  get diagnostics n=row_count;

  update public.profiles p
  set actif=false
  where p.actif=true and (
    exists (
      select 1 from public.abonnements_promoteurs ap
      join public.promoteur_pharmacies pp on pp.promoteur_id=ap.promoteur_id
      where pp.pharmacie_id=p.pharmacie_id and ap.statut='impaye'
    )
    or exists (select 1 from public.abonnements_promoteurs ap where ap.promoteur_id=p.id and ap.statut='impaye')
  );
  return n;
end;
$function$;
revoke all on function public.synchroniser_validite_pharmacies() from public,anon,authenticated;
grant execute on function public.synchroniser_validite_pharmacies() to service_role;

do $schedule$
declare
  v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname='naxa-promoteur-validity-hourly'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
  perform cron.schedule('naxa-promoteur-validity-hourly','15 * * * *','select public.synchroniser_validite_pharmacies();');
end;
$schedule$;

commit;
