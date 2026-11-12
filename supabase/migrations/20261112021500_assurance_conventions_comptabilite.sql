-- Assurance NAXA : conventions, gel financier, journal immuable et règlements.
-- Migration additive. Aucune donnée historique n'est recalculée.

create or replace function private.assurance_normaliser_nom(p_nom text)
returns text language sql immutable set search_path = ''
as $$
  select nullif(
    regexp_replace(
      translate(lower(trim(coalesce(p_nom,''))),
        'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ',
        'aaaaaaceeeeiiiinooooouuuuyy'),
      '[^a-z0-9]+','','g'
    ),'')
$$;

alter table public.assureurs
  add column if not exists nom_normalise text,
  add column if not exists cree_par uuid references auth.users(id);

update public.assureurs
set nom_normalise=private.assurance_normaliser_nom(nom)
where nom_normalise is null;

create unique index if not exists assureurs_nom_normalise_unique
  on public.assureurs(nom_normalise) where actif=true and nom_normalise is not null;

create table if not exists public.assurance_conventions (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  assureur_id uuid not null references public.assureurs(id) on delete restrict,
  statut text not null default 'active' check (statut in ('active','suspendue','expiree')),
  reference_convention text,
  date_debut date not null default current_date,
  date_fin date,
  cree_par uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_fin is null or date_fin >= date_debut),
  unique(pharmacie_id,assureur_id)
);
create index if not exists assurance_conventions_assureur_idx
  on public.assurance_conventions(assureur_id,statut,date_debut,date_fin);

create table if not exists public.assurance_regles_convention (
  id uuid primary key default gen_random_uuid(),
  convention_id uuid not null references public.assurance_conventions(id) on delete restrict,
  portee text not null check (portee in ('tout','categorie','produit')),
  categorie text,
  produit_id uuid references public.produits(id) on delete restrict,
  taux numeric(5,2) not null check (taux between 0 and 100),
  plafond_fcfa bigint check (plafond_fcfa is null or plafond_fcfa >= 0),
  franchise_fcfa bigint not null default 0 check (franchise_fcfa >= 0),
  exclusions jsonb not null default '[]'::jsonb check (jsonb_typeof(exclusions)='array'),
  justificatifs_requis jsonb not null default '[]'::jsonb check (jsonb_typeof(justificatifs_requis)='array'),
  valide_du date not null default current_date,
  valide_jusquau date,
  version integer not null default 1 check (version > 0),
  actif boolean not null default true,
  cree_par uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (valide_jusquau is null or valide_jusquau >= valide_du),
  check ((portee='tout' and categorie is null and produit_id is null)
      or (portee='categorie' and categorie is not null and produit_id is null)
      or (portee='produit' and produit_id is not null))
);
create index if not exists assurance_regles_convention_lookup_idx
  on public.assurance_regles_convention(convention_id,actif,valide_du,valide_jusquau);

alter table public.dossiers_assurance
  add column if not exists reservation_id uuid references public.reservations(id) on delete restrict,
  add column if not exists montant_rembourse numeric(14,0) not null default 0,
  add column if not exists statut_remboursement text not null default 'non_demande'
    check (statut_remboursement in ('non_demande','en_attente','partiel','solde')),
  add column if not exists dernier_remboursement_at timestamptz;

create unique index if not exists dossiers_assurance_reservation_unique
  on public.dossiers_assurance(reservation_id) where reservation_id is not null;

create table if not exists public.assurance_reservation_snapshots (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  couverture_id uuid not null references public.couvertures_assurance(id) on delete restrict,
  assureur_id uuid not null references public.assureurs(id) on delete restrict,
  montant_brut_fcfa bigint not null check (montant_brut_fcfa >= 0),
  montant_assureur_fcfa bigint not null check (montant_assureur_fcfa >= 0),
  montant_client_fcfa bigint not null check (montant_client_fcfa >= 0),
  regle_snapshot jsonb not null,
  calcule_le timestamptz not null default now(),
  valide_client_le timestamptz,
  valide_client boolean not null default false,
  controle_documents_le timestamptz,
  controle_documents_par uuid references auth.users(id),
  controle_documents_statut text not null default 'a_controler'
    check (controle_documents_statut in ('a_controler','conforme','non_conforme')),
  montant_modifie_le timestamptz,
  accord_client_modification_le timestamptz,
  check (montant_brut_fcfa = montant_assureur_fcfa + montant_client_fcfa),
  check (montant_assureur_fcfa <= montant_brut_fcfa)
);
create index if not exists assurance_snapshots_pharmacie_idx
  on public.assurance_reservation_snapshots(pharmacie_id,calcule_le desc);
create index if not exists assurance_snapshots_assureur_idx
  on public.assurance_reservation_snapshots(assureur_id,calcule_le desc);

create table if not exists public.assurance_evenements (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  reservation_id uuid references public.reservations(id) on delete restrict,
  dossier_id uuid references public.dossiers_assurance(id) on delete restrict,
  assureur_id uuid references public.assureurs(id) on delete restrict,
  acteur_id uuid references auth.users(id),
  type text not null check (type in (
    'devis_calcule','reservation_assurance_validee','documents_controles',
    'prise_en_charge_confirmee','prise_en_charge_refusee','montant_modifie',
    'accord_client_obtenu','vente_assurance_enregistree',
    'remboursement_recu','remboursement_partiel','dossier_solde'
  )),
  montant_fcfa bigint check (montant_fcfa is null or montant_fcfa >= 0),
  reference text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists assurance_evenements_pharmacie_idx
  on public.assurance_evenements(pharmacie_id,created_at desc);
create index if not exists assurance_evenements_reservation_idx
  on public.assurance_evenements(reservation_id,created_at);

create table if not exists public.assurance_reglements (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers_assurance(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  assureur_id uuid not null references public.assureurs(id) on delete restrict,
  montant_fcfa bigint not null check (montant_fcfa > 0),
  date_encaissement date not null,
  reference_encaissement text not null check (length(trim(reference_encaissement)) between 3 and 120),
  preuve_path text,
  enregistre_par uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(pharmacie_id,assureur_id,reference_encaissement)
);
create index if not exists assurance_reglements_dossier_idx
  on public.assurance_reglements(dossier_id,date_encaissement desc);

alter table public.assurance_conventions enable row level security;
alter table public.assurance_regles_convention enable row level security;
alter table public.assurance_reservation_snapshots enable row level security;
alter table public.assurance_evenements enable row level security;
alter table public.assurance_reglements enable row level security;

drop policy if exists assurance_conventions_scope_read on public.assurance_conventions;
create policy assurance_conventions_scope_read on public.assurance_conventions
for select to authenticated using (public.can_access_pharmacy(pharmacie_id));

drop policy if exists assurance_regles_scope_read on public.assurance_regles_convention;
create policy assurance_regles_scope_read on public.assurance_regles_convention
for select to authenticated using (
  exists(select 1 from public.assurance_conventions c
    where c.id=convention_id and public.can_access_pharmacy(c.pharmacie_id))
);

drop policy if exists assurance_snapshots_scope_read on public.assurance_reservation_snapshots;
create policy assurance_snapshots_scope_read on public.assurance_reservation_snapshots
for select to authenticated using (
  client_id=(select auth.uid()) or public.can_access_pharmacy(pharmacie_id)
);

drop policy if exists assurance_evenements_scope_read on public.assurance_evenements;
create policy assurance_evenements_scope_read on public.assurance_evenements
for select to authenticated using (
  public.can_access_pharmacy(pharmacie_id)
  or exists(select 1 from public.reservations r
    where r.id=reservation_id and r.client_id=(select auth.uid()))
);

drop policy if exists assurance_reglements_scope_read on public.assurance_reglements;
create policy assurance_reglements_scope_read on public.assurance_reglements
for select to authenticated using (public.can_access_pharmacy(pharmacie_id));

-- Toute écriture métier passe par une RPC contrôlée ; pas d'écriture directe via Data API.
revoke insert,update,delete on public.assurance_conventions from anon,authenticated;
revoke insert,update,delete on public.assurance_regles_convention from anon,authenticated;
revoke insert,update,delete on public.assurance_reservation_snapshots from anon,authenticated;
revoke insert,update,delete on public.assurance_evenements from anon,authenticated;
revoke insert,update,delete on public.assurance_reglements from anon,authenticated;

create or replace function public.assurance_ajouter_assureur(p_nom text,p_code text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid:=auth.uid(); v_nom text:=left(trim(coalesce(p_nom,'')),160);
        v_norm text; v_id uuid;
begin
  if v_uid is null or private.naxa_business_function(v_uid)<>'promoteur'
     or not private.naxa_promoteur_valide(v_uid) then
    raise exception 'Action réservée à un Promoteur actif';
  end if;
  v_norm:=private.assurance_normaliser_nom(v_nom);
  if v_norm is null or length(v_norm)<2 then raise exception 'Nom d’assureur invalide'; end if;
  insert into public.assureurs(nom,code,actif,nom_normalise,cree_par)
  values(v_nom,nullif(left(trim(coalesce(p_code,'')),40),''),true,v_norm,v_uid)
  on conflict (nom_normalise) where actif=true and nom_normalise is not null
  do update set nom=public.assureurs.nom
  returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.assurance_ajouter_assureur(text,text) from public,anon;
grant execute on function public.assurance_ajouter_assureur(text,text) to authenticated;

create or replace function public.assurance_enregistrer_remboursement(
  p_dossier uuid,p_montant_fcfa bigint,p_date date,p_reference text,p_preuve_path text default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid:=auth.uid(); v_d public.dossiers_assurance%rowtype;
        v_total bigint; v_reglement uuid; v_restant bigint; v_event_type text;
begin
  if v_uid is null or p_montant_fcfa is null or p_montant_fcfa<=0
     or p_date is null or p_date>current_date
     or length(trim(coalesce(p_reference,''))) not between 3 and 120 then
    raise exception 'Données de remboursement invalides';
  end if;
  select * into v_d from public.dossiers_assurance where id=p_dossier for update;
  if not found or not private.naxa_scope_allows(v_uid,v_d.pharmacie_id,'PHARMACIE') then
    raise exception 'Dossier assurance inaccessible';
  end if;
  if private.naxa_business_function(v_uid) not in ('promoteur','comptable','caisse','responsable') then
    raise exception 'Poste non autorisé à enregistrer un règlement';
  end if;
  if v_d.statut<>'accepte' then raise exception 'La prise en charge doit être confirmée avant le remboursement'; end if;
  v_total:=round(v_d.montant_prise_en_charge)::bigint;
  v_restant:=v_total-coalesce(round(v_d.montant_rembourse)::bigint,0);
  if p_montant_fcfa>v_restant then raise exception 'Le montant dépasse la créance assureur restante'; end if;
  insert into public.assurance_reglements(
    dossier_id,pharmacie_id,assureur_id,montant_fcfa,date_encaissement,
    reference_encaissement,preuve_path,enregistre_par
  ) values(
    v_d.id,v_d.pharmacie_id,(select c.assureur_id from public.couvertures_assurance c where c.id=v_d.couverture_id),
    p_montant_fcfa,p_date,trim(p_reference),nullif(trim(coalesce(p_preuve_path,'')),''),v_uid
  ) returning id into v_reglement;
  update public.dossiers_assurance
  set montant_rembourse=coalesce(montant_rembourse,0)+p_montant_fcfa,
      statut_remboursement=case when coalesce(montant_rembourse,0)+p_montant_fcfa=v_total then 'solde' else 'partiel' end,
      dernier_remboursement_at=now()
  where id=v_d.id;
  v_event_type:=case when coalesce(v_d.montant_rembourse,0)+p_montant_fcfa=v_total
    then 'dossier_solde' else 'remboursement_partiel' end;
  insert into public.assurance_evenements(
    pharmacie_id,reservation_id,dossier_id,assureur_id,acteur_id,type,montant_fcfa,reference,details
  ) values(
    v_d.pharmacie_id,v_d.reservation_id,v_d.id,
    (select c.assureur_id from public.couvertures_assurance c where c.id=v_d.couverture_id),
    v_uid,v_event_type,p_montant_fcfa,trim(p_reference),
    jsonb_build_object('reglement_id',v_reglement,'date_encaissement',p_date)
  );
  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,donnees,statut
  ) values(
    v_d.pharmacie_id,'assurance_remboursement_recu','reglement_assurance',v_reglement::text,
    'assurance-remboursement:'||v_reglement::text,p_date::timestamptz,
    jsonb_build_object('date_comptable',p_date::text,'montant_fcfa',p_montant_fcfa,
      'reference_source',trim(p_reference),'dossier_id',v_d.id::text,'assureur_id',
      (select c.assureur_id::text from public.couvertures_assurance c where c.id=v_d.couverture_id)),
    'a_traiter'
  ) on conflict (cle_idempotence) do nothing;
  return v_reglement;
end
$$;
revoke all on function public.assurance_enregistrer_remboursement(uuid,bigint,date,text,text) from public,anon;
grant execute on function public.assurance_enregistrer_remboursement(uuid,bigint,date,text,text) to authenticated;

-- Le moteur comptable générique traite aussi les deux événements Assurance.
-- Le worker exige des mappings débit/crédit et un journal validés par pharmacie :
-- aucune écriture n'est postée avec un compte ou un journal implicite.
do $$
declare v_def text;
begin
  v_def:=pg_get_functiondef('public.compta_traiter_evenement(uuid,uuid)'::regprocedure);
  if position('assurance_prise_en_charge' in v_def)>0 then return; end if;
  v_def:=replace(v_def,
    'if v_event.evenement_type not in (''vente_encaissee'',''depense_validee'',''vente_annulee'')' || E'\n' ||
    '       or v_event.source_type not in (''vente'',''depense'',''vente_annulation'') then',
    'if v_event.evenement_type not in (''vente_encaissee'',''depense_validee'',''vente_annulee'',''assurance_prise_en_charge'',''assurance_remboursement_recu'')' || E'\n' ||
    '       or v_event.source_type not in (''vente'',''depense'',''vente_annulation'',''dossier_assurance'',''reglement_assurance'') then');
  if position('assurance_remboursement_recu' in v_def)=0 then
    raise exception 'Impossible d’étendre le worker comptable : contrat source inattendu';
  end if;
  execute v_def;
end
$$;
