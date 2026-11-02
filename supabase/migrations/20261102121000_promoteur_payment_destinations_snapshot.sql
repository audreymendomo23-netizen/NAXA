-- Payment destination configuration managed by active NAXA Admin.
-- Each submission snapshots the exact destination shown to the Promoter.
create table if not exists public.naxa_payment_destinations (
  id uuid primary key default gen_random_uuid(),
  canal text not null unique check (canal in ('orange_money','mtn_momo','virement')),
  beneficiaire text not null check (length(trim(beneficiaire)) between 2 and 160),
  reference_destination text not null check (length(trim(reference_destination)) between 3 and 160),
  instructions text,
  actif boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.naxa_payment_destinations enable row level security;
revoke all on public.naxa_payment_destinations from public, anon, authenticated;
grant all on public.naxa_payment_destinations to service_role;

alter table public.abonnement_promoteur_reglements
  add column if not exists destination_snapshot jsonb,
  add column if not exists destination_snapshot_at timestamptz,
  add column if not exists declared_at timestamptz not null default now();

create index if not exists abonnement_promoteur_reglements_declared_at_idx
  on public.abonnement_promoteur_reglements(statut, declared_at);

-- The declaration RPC records the exact merchant destination shown at submission.
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
  v_destination jsonb;
  v_declared_at timestamptz := clock_timestamp();
begin
  if p_promoteur is null or not exists (
    select 1 from public.profiles where id = p_promoteur and role::text = 'promoteur'
  ) then
    raise exception 'Promoteur introuvable';
  end if;
  if p_montant is null or p_montant <= 0 then
    raise exception 'Montant invalide';
  end if;
  if p_canal not in ('orange_money','mtn_momo','virement') then
    raise exception 'Canal de paiement invalide';
  end if;
  if length(trim(coalesce(p_compte_payeur,''))) < 3 or length(trim(p_compte_payeur)) > 120 then
    raise exception 'Le numéro de compte ou de téléphone ayant effectué le paiement est requis';
  end if;
  if nullif(trim(coalesce(p_reference,'')), '') is null or length(trim(p_reference)) > 160 then
    raise exception 'La référence de transaction ou de virement est obligatoire';
  end if;
  if p_paye_le is null or p_paye_le > v_declared_at + interval '5 minutes' then
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
    where promoteur_id = p_promoteur and statut in ('en_attente','non_confirme')
  ) then
    raise exception 'Un règlement est déjà en attente pour ce Promoteur';
  end if;

  select jsonb_build_object(
    'canal', d.canal,
    'beneficiaire', d.beneficiaire,
    'reference_destination', d.reference_destination,
    'instructions', d.instructions,
    'updated_at', d.updated_at
  )
  into v_destination
  from public.naxa_payment_destinations d
  where d.canal = p_canal and d.actif = true
  for share;
  if v_destination is null then
    raise exception 'La destination de paiement de ce canal n’est pas encore configurée par NAXA';
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
    reference, paye_le, preuve_path, enregistre_par, destination_snapshot,
    destination_snapshot_at, declared_at
  )
  values (
    p_promoteur, v_abonnement.id, p_montant, p_canal,
    null, trim(p_compte_payeur), trim(p_reference),
    p_paye_le, p_preuve_path, p_promoteur, v_destination,
    v_declared_at, v_declared_at
  )
  returning id into v_id;

  v_canal_label := case p_canal
    when 'orange_money' then 'Orange Money'
    when 'mtn_momo' then 'MTN Mobile Money'
    when 'virement' then 'Virement bancaire'
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
        '. Référence : ' || trim(p_reference) ||
        '. Déclaration reçue : ' || to_char(v_declared_at at time zone 'Africa/Douala','DD/MM/YYYY HH24:MI') ||
        '. Vérifiez la preuve et l’encaissement réel avant toute confirmation.',
        1000
      )
    );
  end loop;

  insert into public.notifications(user_id, type, titre, corps)
  values (
    p_promoteur,
    'abonnement_reglement_soumis',
    'Paiement transmis à NAXA',
    'Votre déclaration de paiement a été transmise à NAXA. Le renouvellement interviendra uniquement après confirmation effective.'
  );

  return v_id;
end;
$function$;

revoke all on function public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text) to service_role;
