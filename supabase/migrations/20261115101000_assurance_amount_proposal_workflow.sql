-- NAXA Assurance — versioned amount proposals without rewriting the initial quote.
begin;

create table if not exists public.assurance_montant_propositions (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers_assurance(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  snapshot_id uuid not null references public.assurance_reservation_snapshots(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  version integer not null check (version > 0),
  statut text not null default 'proposee'
    check (statut in ('proposee','acceptee','refusee','remplacee')),
  montant_total_fcfa bigint not null check (montant_total_fcfa >= 0),
  montant_assureur_fcfa bigint not null check (
    montant_assureur_fcfa >= 0 and montant_assureur_fcfa <= montant_total_fcfa
  ),
  montant_client_fcfa bigint not null check (montant_client_fcfa >= 0),
  motif text not null check (char_length(btrim(motif)) between 3 and 500),
  proposee_par uuid not null references auth.users(id) on delete restrict,
  proposee_le timestamptz not null default now(),
  decidee_par uuid references auth.users(id) on delete restrict,
  decidee_le timestamptz,
  remplacee_par uuid references auth.users(id) on delete restrict,
  remplacee_le timestamptz,
  constraint assurance_montant_propositions_split_check
    check (montant_total_fcfa = montant_assureur_fcfa + montant_client_fcfa),
  constraint assurance_montant_propositions_version_uq
    unique (dossier_id, version)
);

create unique index if not exists assurance_montant_propositions_pending_dossier_uq
  on public.assurance_montant_propositions(dossier_id)
  where statut='proposee';

create index if not exists assurance_montant_propositions_client_date_idx
  on public.assurance_montant_propositions(client_id,proposee_le desc);

create index if not exists assurance_montant_propositions_pharmacy_date_idx
  on public.assurance_montant_propositions(pharmacie_id,proposee_le desc);

alter table public.assurance_montant_propositions enable row level security;

drop policy if exists assurance_montant_propositions_scope_read
  on public.assurance_montant_propositions;

create policy assurance_montant_propositions_scope_read
on public.assurance_montant_propositions
for select
to authenticated
using (
  client_id=(select auth.uid())
  or public.can_access_pharmacy(pharmacie_id)
  or (select public.is_admin())
);

revoke all on table public.assurance_montant_propositions from public,anon,authenticated;
grant select on table public.assurance_montant_propositions to authenticated;
grant all on table public.assurance_montant_propositions to service_role;

alter table public.assurance_evenements
  drop constraint if exists assurance_evenements_type_check;

alter table public.assurance_evenements
  add constraint assurance_evenements_type_check
  check (type = any (array[
    'devis_calcule',
    'reservation_assurance_validee',
    'documents_controles',
    'prise_en_charge_confirmee',
    'prise_en_charge_refusee',
    'montant_modifie',
    'accord_client_obtenu',
    'accord_client_refuse',
    'vente_assurance_enregistree',
    'remboursement_recu',
    'remboursement_partiel',
    'dossier_solde'
  ]::text[]));

create or replace function public.assurance_proposer_montant(
  p_dossier uuid,
  p_montant_assureur_fcfa bigint,
  p_motif text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_d public.dossiers_assurance%rowtype;
  v_s public.assurance_reservation_snapshots%rowtype;
  v_id uuid;
  v_version integer;
  v_total bigint;
  v_client bigint;
begin
  if v_uid is null then
    raise exception 'Connexion professionnelle requise';
  end if;

  v_role:=private.naxa_business_function(v_uid);
  if v_role not in ('promoteur','pharmacien','responsable') then
    raise exception 'Proposition réservée au Promoteur, Pharmacien ou Responsable';
  end if;

  select * into v_d
  from public.dossiers_assurance
  where id=p_dossier
  for update;

  if not found
     or not private.naxa_scope_allows(v_uid,v_d.pharmacie_id,'PHARMACIE') then
    raise exception 'Dossier Assurance hors périmètre';
  end if;

  if v_d.statut<>'soumis' or v_d.vente_id is not null
     or coalesce(v_d.montant_rembourse,0)<>0 then
    raise exception 'La négociation est fermée après la décision finale ou le rattachement à une vente';
  end if;

  select * into v_s
  from public.assurance_reservation_snapshots
  where reservation_id=v_d.reservation_id
  for update;

  if not found or v_s.client_id is distinct from v_d.client_id
     or v_s.pharmacie_id is distinct from v_d.pharmacie_id
     or v_s.valide_client is not true then
    raise exception 'Le devis initial doit avoir été accepté par le Client';
  end if;

  if v_s.controle_documents_statut='non_conforme' then
    raise exception 'Une non-conformité documentaire bloque la proposition';
  end if;

  if v_d.montant_total is null or v_d.montant_prise_en_charge is null
     or v_s.montant_brut_fcfa is null or v_s.montant_assureur_fcfa is null then
    raise exception 'Montants du dossier ou du devis initial incomplets';
  end if;

  v_total:=round(v_d.montant_total)::bigint;

  if v_total<>v_s.montant_brut_fcfa
     or v_d.montant_prise_en_charge<0
     or round(v_d.montant_prise_en_charge)::bigint>v_s.montant_assureur_fcfa then
    raise exception 'Le montant brut du dossier ne correspond pas au devis initial';
  end if;

  if p_montant_assureur_fcfa is null or p_montant_assureur_fcfa<0
     or p_montant_assureur_fcfa>least(
       v_s.montant_assureur_fcfa,
       round(v_d.montant_prise_en_charge)::bigint
     ) then
    raise exception 'La part assureur proposée doit être comprise entre zéro et la part déjà acceptée';
  end if;

  if p_montant_assureur_fcfa=round(v_d.montant_prise_en_charge)::bigint then
    raise exception 'La proposition doit modifier le montant actuel';
  end if;

  if char_length(btrim(coalesce(p_motif,''))) not between 3 and 500 then
    raise exception 'Un motif de modification de 3 à 500 caractères est obligatoire';
  end if;

  v_client:=v_total-p_montant_assureur_fcfa;

  update public.assurance_montant_propositions
  set statut='remplacee',remplacee_par=v_uid,remplacee_le=now()
  where dossier_id=v_d.id and statut='proposee';

  select coalesce(max(version),0)+1 into v_version
  from public.assurance_montant_propositions
  where dossier_id=v_d.id;

  insert into public.assurance_montant_propositions(
    dossier_id,reservation_id,snapshot_id,pharmacie_id,client_id,
    version,statut,montant_total_fcfa,montant_assureur_fcfa,
    montant_client_fcfa,motif,proposee_par
  ) values (
    v_d.id,v_d.reservation_id,v_s.id,v_d.pharmacie_id,v_d.client_id,
    v_version,'proposee',v_total,p_montant_assureur_fcfa,
    v_client,left(btrim(p_motif),500),v_uid
  )
  returning id into v_id;

  -- Only negotiation metadata is updated. The original quote amounts,
  -- item/rule snapshot and client acceptance remain immutable.
  update public.assurance_reservation_snapshots
  set montant_modifie_le=now()
  where id=v_s.id;

  insert into public.assurance_evenements(
    pharmacie_id,reservation_id,dossier_id,assureur_id,acteur_id,
    type,montant_fcfa,details
  ) values (
    v_d.pharmacie_id,v_d.reservation_id,v_d.id,v_s.assureur_id,v_uid,
    'montant_modifie',v_total,
    jsonb_build_object(
      'proposition_id',v_id,
      'version',v_version,
      'montant_brut_fcfa',v_total,
      'montant_assureur_initial_fcfa',v_s.montant_assureur_fcfa,
      'montant_assureur_propose_fcfa',p_montant_assureur_fcfa,
      'montant_client_propose_fcfa',v_client,
      'motif',left(btrim(p_motif),500)
    )
  );

  return v_id;
end;
$function$;

create or replace function public.assurance_repondre_proposition_montant(
  p_proposition uuid,
  p_accepter boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_d public.dossiers_assurance%rowtype;
  v_p public.assurance_montant_propositions%rowtype;
  v_s public.assurance_reservation_snapshots%rowtype;
begin
  if v_uid is null or p_accepter is null
     or private.naxa_business_function(v_uid)<>'client'
     or not exists (
       select 1 from public.profiles p
       where p.id=v_uid and p.role='client' and p.actif=true
     ) then
    raise exception 'Compte Client actif en rôle Client et décision explicite requis';
  end if;

  select d.* into v_d
  from public.dossiers_assurance d
  join public.assurance_montant_propositions p on p.dossier_id=d.id
  where p.id=p_proposition
  for update of d;

  if not found or v_d.client_id is distinct from v_uid then
    raise exception 'Proposition inaccessible : seul le Client propriétaire peut répondre';
  end if;

  select * into v_p
  from public.assurance_montant_propositions
  where id=p_proposition and dossier_id=v_d.id
  for update;

  if not found or v_p.client_id is distinct from v_uid
     or v_p.statut<>'proposee' or v_d.statut<>'soumis'
     or v_d.vente_id is not null or coalesce(v_d.montant_rembourse,0)<>0 then
    raise exception 'Cette proposition n''est plus en attente de votre décision';
  end if;

  select * into v_s
  from public.assurance_reservation_snapshots
  where id=v_p.snapshot_id
  for update;

  if not found or v_s.reservation_id is distinct from v_d.reservation_id
     or v_s.valide_client is not true
     or v_p.montant_total_fcfa<>v_s.montant_brut_fcfa
     or v_p.montant_assureur_fcfa>v_s.montant_assureur_fcfa then
    raise exception 'La proposition ne correspond plus au devis initial';
  end if;

  if p_accepter then
    update public.assurance_montant_propositions
    set statut='acceptee',decidee_par=v_uid,decidee_le=now()
    where id=v_p.id;

    update public.dossiers_assurance
    set montant_prise_en_charge=v_p.montant_assureur_fcfa,
        montant_client=v_p.montant_client_fcfa
    where id=v_d.id and statut='soumis';

    if not found then
      raise exception 'Le dossier a changé avant l''acceptation';
    end if;

    update public.assurance_reservation_snapshots
    set accord_client_modification_le=now()
    where id=v_s.id;

    insert into public.assurance_evenements(
      pharmacie_id,reservation_id,dossier_id,assureur_id,acteur_id,
      type,montant_fcfa,details
    ) values (
      v_d.pharmacie_id,v_d.reservation_id,v_d.id,v_s.assureur_id,v_uid,
      'accord_client_obtenu',v_p.montant_total_fcfa,
      jsonb_build_object(
        'proposition_id',v_p.id,
        'version',v_p.version,
        'montant_assureur_fcfa',v_p.montant_assureur_fcfa,
        'montant_client_fcfa',v_p.montant_client_fcfa
      )
    );
  else
    update public.assurance_montant_propositions
    set statut='refusee',decidee_par=v_uid,decidee_le=now()
    where id=v_p.id;

    insert into public.assurance_evenements(
      pharmacie_id,reservation_id,dossier_id,assureur_id,acteur_id,
      type,montant_fcfa,details
    ) values (
      v_d.pharmacie_id,v_d.reservation_id,v_d.id,v_s.assureur_id,v_uid,
      'accord_client_refuse',v_p.montant_total_fcfa,
      jsonb_build_object('proposition_id',v_p.id,'version',v_p.version)
    );
  end if;
end;
$function$;

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
  ) on conflict (cle_idempotence) do nothing;
end;
$function$;

revoke all on function public.assurance_proposer_montant(uuid,bigint,text)
  from public,anon;

grant execute on function public.assurance_proposer_montant(uuid,bigint,text)
  to authenticated,service_role;

revoke all on function public.assurance_repondre_proposition_montant(uuid,boolean)
  from public,anon;

grant execute on function public.assurance_repondre_proposition_montant(uuid,boolean)
  to authenticated,service_role;

revoke all on function public.assurance_confirmer_prise_en_charge(uuid,text)
  from public,anon;

grant execute on function public.assurance_confirmer_prise_en_charge(uuid,text)
  to authenticated,service_role;

comment on table public.assurance_montant_propositions is
  'Historique versionné des propositions de partage Assurance ; les états de cycle de vie sont conservés et le snapshot initial reste immuable.';
comment on column public.assurance_montant_propositions.montant_assureur_fcfa is
  'Part assureur proposée ; elle ne peut jamais dépasser la part du devis initial.';
comment on column public.assurance_reservation_snapshots.montant_modifie_le is
  'Horodatage de la dernière proposition de partage, sans modification des montants du snapshot.';
comment on column public.assurance_reservation_snapshots.accord_client_modification_le is
  'Horodatage du dernier accord client à une proposition versionnée.';

commit;
